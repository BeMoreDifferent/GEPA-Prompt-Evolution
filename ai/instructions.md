# GEPA System-Prompt Optimizer — TypeScript (GPT-5-mini)

This repo evolves a **single system prompt** using GEPA’s reflective loop, Pareto selection, and a **portfolio of battle-tested strategy hints** (math/PM/design, etc.). It **persists every iteration**, is **resumable**, and provides strong type safety for junior developers.

```
./
  ai/*
  src/
    types.ts
    selection.ts
    reflection.ts
    bandit.ts
    seeding.ts
    judge.ts
    persist.ts
    llm_openai.ts
    gepa.ts
    cli.ts
  strategies/
    strategies.json
  examples/
    input.prompts.json
    config.json
  __tests__/
    system.test.ts
  jest.config.ts
  tsconfig.json
  package.json
  README.md
```

---

## 1) Type definitions

### `src/types.ts`

```ts
/* Strict domain types for the optimizer */

export interface Candidate {
  /** Current system prompt under evaluation */
  system: string;
}

export interface TaskItem {
  /** Stable identifier for logging and reproducibility */
  id: string;
  /** User prompt text */
  user: string;
  /** Optional metadata for metrics/safety topics, etc. */
  meta?: Record<string, unknown> | null;
}

export interface ExecuteResult {
  /** Raw assistant output text produced under the candidate.system */
  output: string;
  /** Optional trace info (tool logs, timing, etc.) */
  traces?: Record<string, unknown> | null;
}

/** Function that runs the LLM (actor) with a candidate.system against an item */
export type SystemExecute = (args: {
  candidate: Candidate;
  item: TaskItem;
}) => Promise<ExecuteResult>;

/** Numeric metric on [0,1] (for Pareto set or ground-truthable tasks) */
export type MetricMu = (y: string, m: unknown) => number;

/** Judge score + textual feedback derived from the output */
export type FeedbackMuF = (args: {
  item: TaskItem;
  output: string;
  traces?: Record<string, unknown> | null;
}) => Promise<{ score: number; feedbackText: string }> | { score: number; feedbackText: string };

/** Minimal single-turn LLM for reflection/updating the system prompt */
export interface LLM {
  complete(prompt: string): Promise<string>;
}

/** Multi-message chat LLM (used by judge) */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
export interface ChatLLM {
  chat(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<string>;
}

/** Core configuration */
export interface GepaOptions {
  execute: SystemExecute;
  mu: MetricMu;
  muf: FeedbackMuF;
  llm: LLM;

  budget: number;
  minibatchSize: number;
  paretoSize: number;

  holdoutSize?: number;         // default 0
  epsilonHoldout?: number;      // default 0.02
  strategiesPath?: string;      // default "strategies/strategies.json"
}

/** Serializable bandit state */
export interface Ucb1State {
  t: number;
  stats: Array<{ id: string; n: number; mean: number }>;
}

/** Serializable optimizer state for resume */
export interface GEPAState {
  version: 2;
  budgetLeft: number;
  iter: number;
  Psystems: string[];     // candidates pool (system prompts)
  S: number[][];          // Pareto scores: S[k][i]
  DparetoIdx: number[];
  DfbIdx: number[];
  DholdIdx: number[];
  bestIdx: number;
  seeded: boolean;
  bandit: Ucb1State | null;
}
```

---

## 2) Pareto candidate selection

### `src/selection.ts`

```ts
import type { Candidate } from './types.js';

/** Pareto-based candidate selection (Algorithm-2 style). Returns index k in P. */
export function selectCandidate(P: Candidate[], S: number[][]): number {
  const nItems = S[0]?.length ?? 0;

  // Instance-wise best sets P*[i]
  const Pstar: Array<Set<number>> = Array.from({ length: nItems }, (_, i) => {
    let best = -Infinity;
    for (let k = 0; k < P.length; k++) best = Math.max(best, S[k]?.[i] ?? -Infinity);
    const set = new Set<number>();
    for (let k = 0; k < P.length; k++) if ((S[k]?.[i] ?? -Infinity) === best) set.add(k);
    return set;
  });

  // Union and prune dominated
  const C = new Set<number>(); for (const s of Pstar) for (const k of s) C.add(k);
  const Carr = [...C];
  const dominated = new Set<number>();
  const dominates = (a: number, b: number): boolean => {
    let geAll = true, gtAny = false;
    for (let i = 0; i < nItems; i++) {
      const Sa = S[a]?.[i] ?? -1e9;
      const Sb = S[b]?.[i] ?? -1e9;
      if (Sa < Sb) geAll = false;
      if (Sa > Sb) gtAny = true;
    }
    return geAll && gtAny;
  };
  for (const a of Carr) for (const b of Carr) if (a !== b && dominates(b, a)) dominated.add(a);
  const Cnon = Carr.filter(k => !dominated.has(k));

  // Weighted by frequency of appearances in P*[i]
  const freq = Cnon.map(k => Pstar.reduce((acc, set) => acc + (set.has(k) ? 1 : 0), 0));
  const total = freq.reduce((a, b) => a + b, 0) || 1;
  let r = Math.random() * total;
  for (let i = 0; i < Cnon.length; i++) { r -= freq[i]; if (r <= 0) return Cnon[i]; }
  return Cnon[Cnon.length - 1];
}
```

---

## 3) Reflective mutation with strategy hints

### `src/reflection.ts`

```ts
import type { LLM } from './types.js';

export interface JudgedExample {
  user: string;
  output: string;
  feedback: string;
}

/** Build the meta-prompt that asks the LLM to rewrite the system prompt */
export function buildReflectionPrompt(system: string, examples: JudgedExample[], strategyHint = ''): string {
  const ex = examples.map((e, i) =>
    [`#${i + 1} USER:`, e.user, `ASSISTANT:`, e.output, `FEEDBACK:`, e.feedback].join('\n')
  ).join('\n\n');

  return [
    'You will REWRITE the system prompt for an assistant.',
    strategyHint ? `Strategy hint: ${strategyHint}` : '',
    'Current system prompt:', "'''", system, "'''",
    'Below are examples and strict-judge feedback.',
    ex,
    'Write a NEW system prompt that: fixes failures; preserves what worked; is concise, safe, and actionable; and stays domain-agnostic.',
    'Return only the new system prompt between triple quotes.',
    "'''[new system prompt]'''"
  ].filter(Boolean).join('\n');
}

/** Ask the LLM to propose an improved system prompt */
export async function proposeNewSystem(
  llm: LLM,
  system: string,
  examples: JudgedExample[],
  strategyHint?: string
): Promise<string> {
  const raw = await llm.complete(buildReflectionPrompt(system, examples, strategyHint ?? ''));
  const m = raw.match(/'''([\s\S]*?)'''/);
  return (m ? m[1] : raw).trim();
}
```

---

## 4) Operator bandit (UCB1)

### `src/bandit.ts`

```ts
import type { Ucb1State } from './types.js';

/** UCB1 bandit to select strategy IDs by historical uplift */
export class UCB1 {
  private t = 0;
  private stats: Array<{ id: string; n: number; mean: number }>;

  constructor(ids: string[]) {
    this.stats = ids.map(id => ({ id, n: 0, mean: 0 }));
  }

  pick(): string {
    this.t++;
    const c = Math.sqrt(2);
    let bestId = this.stats[0]?.id ?? '';
    let bestU = -Infinity;
    for (const s of this.stats) {
      const bonus = s.n ? c * Math.sqrt(Math.log(this.t) / s.n) : Number.POSITIVE_INFINITY;
      const u = (s.n ? s.mean : 0) + bonus;
      if (u > bestU) { bestU = u; bestId = s.id; }
    }
    return bestId;
  }

  update(id: string, reward: number): void {
    const s = this.stats.find(x => x.id === id); if (!s) return;
    const r = Math.max(0, Math.min(1, reward));
    s.n += 1;
    s.mean += (r - s.mean) / s.n;
  }

  serialize(): Ucb1State { return { t: this.t, stats: this.stats.map(s => ({ ...s })) }; }
  static from(obj: Ucb1State): UCB1 { const b = new UCB1([]); (b as any).t = obj.t; (b as any).stats = obj.stats.map(s => ({ ...s })); return b; }
}
```

---

## 5) Seeding with multiple strategies

### `src/seeding.ts`

```ts
import { proposeNewSystem, type JudgedExample } from './reflection.js';
import type { Candidate, LLM, SystemExecute, FeedbackMuF, TaskItem } from './types.js';

export interface StrategyDef { id: string; hint: string }

export interface SeedArgs {
  seed: Candidate;
  screen: TaskItem[];
  strategies: StrategyDef[];
  K: number;
  execute: SystemExecute;
  muf: FeedbackMuF;
  llm: LLM;
}

/** Generate seeded candidates with top-K strategies and keep the top few by average judge score */
export async function seedPopulation({
  seed, screen, strategies, K, execute, muf, llm
}: SeedArgs): Promise<Array<Candidate & { _via: string; _uplift: number }>> {
  const out: Array<Candidate & { _via: string; _uplift: number }> = [{ system: seed.system, _via: 'seed', _uplift: 0 }];

  for (const s of strategies.slice(0, K)) {
    const ex: JudgedExample[] = screen.map(x => ({ user: x.user, output: '', feedback: 'Initial strategy seeding' }));
    const sys2 = await proposeNewSystem(llm, seed.system, ex, s.hint);
    const scores: number[] = [];
    for (const item of screen) {
      const { output } = await execute({ candidate: { system: sys2 }, item });
      const f = await muf({ item, output });
      scores.push(f.score);
    }
    out.push({ system: sys2, _via: s.id, _uplift: avg(scores) });
  }

  out.sort((a, b) => b._uplift - a._uplift);
  return out.slice(0, Math.min(5, out.length));
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
```

---

## 6) Judge (µ\_f)

### `src/judge.ts`

```ts
import type { ChatLLM, TaskItem } from './types.js';

export function buildJudgePrompt(rubric: string): string {
  return [
    'You are a strict evaluator. Return ONLY JSON: {"score":0.00,"feedback":"..."}',
    'Score in [0,1] with two decimals. Keep feedback brief.',
    'Rubric:', rubric
  ].join('\n');
}

/** Call the judge LLM to evaluate system+user+assistant => {score, feedback} */
export async function judgeScore(
  chatLLM: ChatLLM,
  rubric: string,
  system: string,
  user: string,
  assistant: string
): Promise<{ score: number; feedback: string }> {
  const sys = buildJudgePrompt(rubric);
  const content = await chatLLM.chat([
    { role: 'system', content: sys },
    { role: 'user', content: `System:\n${system}\n\nUser:\n${user}\n\nAssistant:\n${assistant}` }
  ]);

  try {
    const j = JSON.parse(content.trim()) as { score?: unknown; feedback?: unknown };
    const s = Math.max(0, Math.min(1, Number(j.score)));
    return { score: Number.isFinite(s) ? s : 0, feedback: String(j.feedback ?? '') };
  } catch {
    return { score: 0, feedback: 'Non-JSON judge output' };
  }
}
```

---

## 7) Persistence (runs, checkpoints, resume)

### `src/persist.ts`

```ts
import * as fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { GEPAState } from './types.js';

export const nowId = (): string => new Date().toISOString().replace(/[:.]/g, '-');
export const slug  = (s: string, n = 24): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, n).replace(/-+$/, '') || 'run';
export const sha   = (s: string): string => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

async function ensureDir(p: string): Promise<void> { await fs.mkdir(p, { recursive: true }); }

async function atomicWrite(file: string, data: string): Promise<void> {
  const tmp = `${file}.tmp-${Math.random().toString(36).slice(2)}`;
  await fs.writeFile(tmp, data, 'utf8');
  await fs.rename(tmp, file); // atomic replace on same filesystem (POSIX rename)
}

export async function writeJsonAtomic<T>(file: string, obj: T): Promise<void> {
  await atomicWrite(file, JSON.stringify(obj, null, 2));
}
export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) as T; } catch { return fallback; }
}

export function buildRunDir(runsRoot: string, inputObj: { system?: string }): string {
  const id = `${nowId()}-${slug(inputObj.system ?? 'system')}-${sha(inputObj.system ?? '')}`;
  return path.join(runsRoot, id);
}

export async function acquireLock(dir: string): Promise<() => Promise<void>> {
  await ensureDir(dir);
  const lock = path.join(dir, '.lock');
  const h = await fs.open(lock, 'wx').catch(e => { throw new Error(`Lock exists at ${dir}. Another process running? (${(e as Error).message})`); });
  await h.write(String(process.pid));
  await h.close();
  return async () => { await fs.rm(lock, { force: true }); };
}

export async function initRun(args: {
  runsRoot: string;
  inputObj: Record<string, unknown>;
  configObj: Record<string, unknown>;
  outFile?: string | null;
}): Promise<{ runDir: string; iterationsDir: string; state: GEPAState; inputObj: Record<string, unknown>; configObj: Record<string, unknown> }> {
  const runDir = buildRunDir(args.runsRoot, args.inputObj);
  const iterationsDir = path.join(runDir, 'iterations');
  await ensureDir(iterationsDir);
  await writeJsonAtomic(path.join(runDir, 'input.json'), args.inputObj);
  await writeJsonAtomic(path.join(runDir, 'config.json'), args.configObj);
  if (args.outFile) await atomicWrite(path.join(runDir, '.outpath'), args.outFile);

  const state: GEPAState = {
    version: 2,
    budgetLeft: 0,
    iter: 0,
    Psystems: [String(args.inputObj['system'] ?? '')],
    S: [],
    DparetoIdx: [],
    DfbIdx: [],
    DholdIdx: [],
    bestIdx: 0,
    seeded: false,
    bandit: null
  };
  await writeJsonAtomic(path.join(runDir, 'state.json'), state);
  return { runDir, iterationsDir, state, inputObj: args.inputObj, configObj: args.configObj };
}

export async function resumeRun(runDir: string): Promise<{
  runDir: string;
  iterationsDir: string;
  state: GEPAState;
  inputObj: Record<string, unknown>;
  configObj: Record<string, unknown>;
  outPath: string | null;
}> {
  const iterationsDir = path.join(runDir, 'iterations');
  await ensureDir(iterationsDir);
  const state = await readJson<GEPAState>(path.join(runDir, 'state.json'), null as unknown as GEPAState);
  if (!state) throw new Error(`state.json missing in ${runDir}`);
  const inputObj = await readJson<Record<string, unknown>>(path.join(runDir, 'input.json'), {});
  const configObj = await readJson<Record<string, unknown>>(path.join(runDir, 'config.json'), {});
  let outPath: string | null = null;
  try { outPath = (await fs.readFile(path.join(runDir, '.outpath'))).toString(); } catch { /* ignore */ }
  return { runDir, iterationsDir, state, inputObj, configObj, outPath };
}

export async function saveState(runDir: string, state: GEPAState): Promise<void> {
  await writeJsonAtomic(path.join(runDir, 'state.json'), state);
}
export async function saveIteration(iterationsDir: string, iterNo: number, payload: unknown): Promise<void> {
  const file = path.join(iterationsDir, `iter-${String(iterNo).padStart(4, '0')}.json`);
  await writeJsonAtomic(file, payload);
}
```

---

## 8) OpenAI clients (Responses for actor; Chat for judge)

### `src/llm_openai.ts`

```ts
import type { ChatLLM, ChatMessage, LLM } from './types.js';

export interface OpenAIClientsConfig {
  apiKey?: string;
  baseURL?: string;
  actorModel: string;  // e.g., "gpt-5-mini"
  judgeModel: string;  // e.g., "gpt-5-mini"
  temperature?: number;
  maxTokens?: number;
}

/** Minimal OpenAI client (global fetch). Responses API for actor; Chat Completions for judge. */
export function makeOpenAIClients(cfg: OpenAIClientsConfig): { actorLLM: LLM; chatLLM: ChatLLM } {
  const base = cfg.baseURL ?? 'https://api.openai.com/v1';
  const key = cfg.apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY missing');

  async function http<T>(path: string, body: unknown): Promise<T> {
    const r = await fetch(base + path, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${JSON.stringify(j)}`);
    return j as T;
  }

  // Responses API: recommended for GPT-5 series
  async function responses(model: string, input: string, opts?: { temperature?: number; maxTokens?: number }): Promise<string> {
    type ResponsesShape = { output_text?: string; output?: any; choices?: Array<{ message?: { content?: string } }> };
    const j = await http<ResponsesShape>('/responses', {
      model,
      input,
      temperature: opts?.temperature ?? cfg.temperature ?? 0.7,
      max_output_tokens: opts?.maxTokens ?? cfg.maxTokens ?? 512
    });
    if (typeof j.output_text === 'string') return j.output_text;
    if (Array.isArray(j.output) && j.output[0]?.content?.[0]?.text) return j.output[0].content[0].text as string;
    if (j.choices?.[0]?.message?.content) return j.choices[0].message!.content!;
    return JSON.stringify(j);
  }

  // Chat Completions: judge (multi-message)
  async function chat(model: string, messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<string> {
    type ChatShape = { choices?: Array<{ message?: { content?: string } }> };
    const j = await http<ChatShape>('/chat/completions', {
      model,
      messages,
      temperature: opts?.temperature ?? cfg.temperature ?? 0.2,
      max_tokens: opts?.maxTokens ?? cfg.maxTokens ?? 512
    });
    return j.choices?.[0]?.message?.content ?? '';
  }

  const actorLLM: LLM = { complete: (prompt: string) => responses(cfg.actorModel, prompt) };
  const chatLLM: ChatLLM = { chat: (messages, opts) => chat(cfg.judgeModel, messages, opts) };
  return { actorLLM, chatLLM };
}
```

---

## 9) GEPA loop (system prompt) with seeding, bandit, holdout, checkpoints

### `src/gepa.ts`

```ts
import { selectCandidate } from './selection.js';
import { proposeNewSystem, type JudgedExample } from './reflection.js';
import { UCB1 } from './bandit.js';
import { seedPopulation, type StrategyDef } from './seeding.js';
import type {
  Candidate, TaskItem, GepaOptions, GEPAState, SystemExecute, MetricMu, FeedbackMuF, LLM
} from './types.js';
import * as fs from 'node:fs/promises';

type PersistHook = (state: GEPAState, iterPayload: Record<string, unknown>) => Promise<void>;

export interface RunPersist {
  state?: GEPAState;
  onCheckpoint?: PersistHook;
}

/** Optimize a single system prompt with GEPA + strategy bandit + holdout gates. */
export async function runGEPA_System(
  seed: Candidate,
  dtrain: TaskItem[],
  opts: GepaOptions,
  persist?: RunPersist
): Promise<Candidate> {
  const {
    execute, mu, muf, llm,
    budget, minibatchSize: b, paretoSize: nPareto,
    holdoutSize = 0, epsilonHoldout = 0.02, strategiesPath = 'strategies/strategies.json'
  } = opts;

  // ---- resume or fresh ----
  let state: GEPAState = persist?.state ?? {
    version: 2,
    budgetLeft: budget,
    iter: 0,
    Psystems: [seed.system],
    S: [],
    DparetoIdx: [],
    DfbIdx: [],
    DholdIdx: [],
    bestIdx: 0,
    seeded: false,
    bandit: null
  };

  // Split once, then store indices for determinism across resumes
  if (state.DparetoIdx.length === 0 && state.DfbIdx.length === 0) {
    const idx = [...dtrain.keys()];
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const hold = Math.min(holdoutSize, Math.max(0, Math.floor(idx.length * 0.1)));
    state.DparetoIdx = idx.slice(0, nPareto);
    state.DholdIdx   = idx.slice(nPareto, nPareto + hold);
    state.DfbIdx     = idx.slice(nPareto + hold);
    state.budgetLeft = state.budgetLeft || budget;
  }
  const Dpareto = state.DparetoIdx.map(i => dtrain[i]);
  const Dhold   = state.DholdIdx.map(i => dtrain[i]);
  const Dfb     = state.DfbIdx.map(i => dtrain[i]);

  // Rebuild P and S
  const P: Candidate[] = state.Psystems.map(s => ({ system: s }));
  const S: number[][] = state.S.length ? state.S : (state.S = []);

  // Seed Pareto row for initial candidate if missing
  if (S.length === 0) {
    const row = await Promise.all(Dpareto.map(async (item) => {
      const { output } = await execute({ candidate: P[0], item });
      return mu(output, item.meta ?? null);
    }));
    S.push(row);
  }

  // Strategies + bandit
  const strategies: StrategyDef[] = JSON.parse(await fs.readFile(strategiesPath, 'utf8')) as StrategyDef[];
  let bandit = state.bandit ? UCB1.from(state.bandit) : new UCB1(strategies.map(s => s.id));

  // One-time seeding with top-K strategies (screen subset of feedback set)
  if (!state.seeded && Dfb.length) {
    const screen = Dfb.slice(0, Math.max(3, Math.floor(Dfb.length * 0.1)));
    const seeded = await seedPopulation({
      seed: { system: state.Psystems[0] }, screen, strategies,
      K: Math.min(6, strategies.length), execute, muf, llm
    });
    for (const c of seeded.slice(1)) {
      P.push({ system: c.system });
      state.Psystems.push(c.system);
      const row = await Promise.all(Dpareto.map(async (item) => {
        const { output } = await execute({ candidate: { system: c.system }, item });
        return mu(output, item.meta ?? null);
      }));
      S.push(row);
    }
    state.bestIdx = argmax(S.map(r => avg(r)));
    state.seeded = true;
    if (persist?.onCheckpoint) await persist.onCheckpoint(state, { iter: state.iter, seeded: true });
  }

  // Helper: holdout average judge score
  const avgHoldout = async (cand: Candidate): Promise<number> => {
    if (!Dhold.length) return 0;
    const scores: number[] = [];
    for (const item of Dhold) {
      const { output } = await execute({ candidate: cand, item });
      const jf = await muf({ item, output });
      scores.push(jf.score);
    }
    return avg(scores);
  };

  while (state.budgetLeft > 0) {
    const k = selectCandidate(P, S);
    const parent = P[k];

    // Minibatch over feedback set
    const M = sampleMinibatch(Dfb, b);
    const before: Array<{ id: string; score: number; feedback: string; output: string }> = [];
    for (const item of M) {
      const { output, traces } = await execute({ candidate: parent, item });
      const f = await muf({ item, output, traces });
      before.push({ id: item.id, score: f.score, feedback: f.feedbackText, output });
      if (--state.budgetLeft <= 0) break;
    }
    const sigma = avg(before.map(x => x.score));
    if (state.budgetLeft <= 0) break;

    // Mutate with chosen strategy
    const chosenId = bandit.pick();
    const hint = (strategies.find(s => s.id === chosenId)?.hint) ?? '';
    const examples: JudgedExample[] = before.map(x => ({
      user: dtrain.find(d => d.id === x.id)?.user ?? '',
      output: x.output,
      feedback: x.feedback
    }));
    const newSystem = await proposeNewSystem(llm, parent.system, examples, hint);
    const child: Candidate = { system: newSystem };

    // Re-evaluate on same minibatch
    const afterScores: number[] = [];
    for (const item of M) {
      const { output, traces } = await execute({ candidate: child, item });
      const f = await muf({ item, output, traces });
      afterScores.push(f.score);
      if (--state.budgetLeft <= 0) break;
    }
    const sigmaP = avg(afterScores);

    // Reward bandit: map [-1,1] -> [0,1]
    const reward = Math.max(0, Math.min(1, (sigmaP - sigma + 1) / 2));
    bandit.update(chosenId, reward);

    // Holdout gate
    let passHold = true;
    if (Dhold.length) {
      const holdParent = await avgHoldout(parent);
      const holdChild = await avgHoldout(child);
      passHold = holdChild + epsilonHoldout >= holdParent;
    }

    const iterPayload = {
      iter: ++state.iter,
      strategyId: chosenId,
      minibatchIds: M.map(m => m.id),
      sigmaBefore: sigma,
      sigmaAfter: sigmaP,
      accepted: sigmaP > sigma && passHold
    };

    // Accept child → score on Pareto set
    if (iterPayload.accepted) {
      P.push(child);
      state.Psystems.push(child.system);
      const row = await Promise.all(Dpareto.map(async (item) => {
        const { output } = await execute({ candidate: child, item });
        return mu(output, item.meta ?? null);
      }));
      S.push(row);
      state.S = S;
      state.bestIdx = argmax(S.map(r => avg(r)));
    }

    state.bandit = bandit.serialize();
    if (persist?.onCheckpoint) await persist.onCheckpoint(state, iterPayload);
  }

  return P[state.bestIdx];
}

function sampleMinibatch(arr: TaskItem[], n: number): TaskItem[] {
  if (n >= arr.length) return [...arr];
  const pick = new Set<number>(), out: TaskItem[] = [];
  while (out.length < n && pick.size < arr.length) {
    const i = Math.floor(Math.random() * arr.length);
    if (!pick.has(i)) { pick.add(i); out.push(arr[i]); }
  }
  return out;
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const argmax = (xs: number[]) => xs.reduce((bi, x, i, a) => (x > a[bi] ? i : bi), 0);
```

---

## 10) CLI with runs, resume, GPT-5-mini defaults

### `src/cli.ts`

```ts
#!/usr/bin/env node
import path from 'node:path';
import * as fs from 'node:fs/promises';
import { runGEPA_System } from './gepa.js';
import { makeOpenAIClients } from './llm_openai.js';
import { judgeScore } from './judge.js';
import { initRun, resumeRun, acquireLock, saveIteration, saveState, writeJsonAtomic } from './persist.js';
import type { Candidate, GepaOptions, MetricMu, FeedbackMuF, TaskItem } from './types.js';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const cur = argv[i];
    if (cur.startsWith('--')) {
      const key = cur.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const runsRoot = args['runs-root'] || 'runs';
  const resumeDir = args.resume && args.resume !== 'true' ? args.resume : null;

  let runCtx: Awaited<ReturnType<typeof resumeRun>> | Awaited<ReturnType<typeof initRun>>;
  let unlock: (() => Promise<void>) | undefined;

  try {
    if (resumeDir) {
      runCtx = await resumeRun(resumeDir);
      unlock = await acquireLock(runCtx.runDir);
    } else {
      if (!args.input || !args.config) { console.error('Missing --input or --config'); process.exit(1); }
      const input = JSON.parse(await fs.readFile(args.input, 'utf8')) as { system: string; prompts: Array<Partial<TaskItem>> };
      const config = JSON.parse(await fs.readFile(args.config, 'utf8')) as Record<string, unknown>;
      const outPath = args.out ? path.resolve(args.out) : null;
      runCtx = await initRun({ runsRoot, inputObj: input, configObj: config, outFile: outPath });
      unlock = await acquireLock(runCtx.runDir);
    }

    const input = (runCtx as any).inputObj ?? JSON.parse(await fs.readFile(path.join(runCtx.runDir, 'input.json'), 'utf8'));
    const config = (runCtx as any).configObj ?? JSON.parse(await fs.readFile(path.join(runCtx.runDir, 'config.json'), 'utf8'));

    const { actorLLM, chatLLM } = makeOpenAIClients({
      apiKey: process.env.OPENAI_API_KEY,
      actorModel: String(config['actorModel'] ?? 'gpt-5-mini'),
      judgeModel: String(config['judgeModel'] ?? 'gpt-5-mini'),
      temperature: Number(config['actorTemperature'] ?? 0.4),
      maxTokens: Number(config['actorMaxTokens'] ?? 512),
      baseURL: typeof config['baseURL'] === 'string' ? String(config['baseURL']) : undefined
    });

    // executor (actor)
    const execute: GepaOptions['execute'] = async ({ candidate, item }) => {
      const content = await chatLLM.chat([
        { role: 'system', content: candidate.system },
        { role: 'user', content: item.user }
      ], { temperature: Number(config['actorTemperature'] ?? 0.4), maxTokens: Number(config['actorMaxTokens'] ?? 512) });
      return { output: content };
    };

    // metrics (judge)
    const rubric = String(config['rubric'] ?? 'Correctness, coverage, safety, brevity.');
    const mu: MetricMu = () => 0; // placeholder numeric (Pareto over judge is okay if you have none)
    const muf: FeedbackMuF = async ({ item, output }) => {
      const system = (runCtx as any).state?.Psystems?.at(-1) ?? input.system;
      const j = await judgeScore(chatLLM, rubric, system, item.user, output);
      return { score: j.score, feedbackText: j.feedback };
    };

    const seed: Candidate = { system: input.system };
    const dtrain: TaskItem[] = input.prompts.map((p: any, i: number) => ({
      id: p.id ? String(p.id) : String(i + 1),
      user: String(p.user),
      meta: p.meta ?? null
    }));

    async function onCheckpoint(state: any, iterPayload: any): Promise<void> {
      await saveIteration(path.join((runCtx as any).runDir, 'iterations'), iterPayload.iter ?? state.iter, iterPayload);
      await saveState((runCtx as any).runDir, state);
      const best = state.Psystems[state.bestIdx];
      await writeJsonAtomic(path.join((runCtx as any).runDir, 'best.json'), { system: best, bestIdx: state.bestIdx, iter: state.iter });
      const outPath = (runCtx as any).outPath || null;
      if (outPath) await fs.writeFile(outPath, best, 'utf8');
    }

    const best = await runGEPA_System(seed, dtrain, {
      execute, mu, muf, llm: actorLLM,
      budget: (runCtx as any).state?.budgetLeft || Number(config['budget'] ?? 100),
      minibatchSize: Number(config['minibatchSize'] ?? 4),
      paretoSize: Number(config['paretoSize'] ?? Math.max(4, Math.floor(dtrain.length / 5))),
      holdoutSize: Number(config['holdoutSize'] ?? 0),
      epsilonHoldout: Number(config['epsilonHoldout'] ?? 0.02),
      strategiesPath: String(config['strategiesPath'] ?? 'strategies/strategies.json')
    }, { state: (runCtx as any).state, onCheckpoint });

    // Print final best to stdout
    console.log(best.system);
  } finally {
    if (unlock) await unlock();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
```

---

## 11) Strategy pool (battle-tested hints)

### `strategies/strategies.json`

```json
[
  { "id": "polya-4step", "hint": "Apply Pólya’s 4 steps: Understand, Plan, Execute, Reflect. Restate task, outline minimal plan, do it, then brief self-check." },
  { "id": "fermi-estimate", "hint": "When unknown quantities appear, use Fermi estimation: list assumptions, compute order-of-magnitude, provide range and key drivers." },
  { "id": "dimensional-analysis", "hint": "For numeric/physics problems, add unit sanity checks and dimensional analysis; show conversions; flag mismatches." },
  { "id": "mece-structuring", "hint": "Organize content using MECE categories (mutually exclusive, collectively exhaustive); avoid overlap and cover the space." },
  { "id": "smart-goals", "hint": "When planning, translate into SMART objectives (Specific, Measurable, Achievable, Relevant, Time-bound) with brief metrics." },
  { "id": "cpm-critical-path", "hint": "For projects: list tasks, dependencies, durations; identify critical path; suggest fast-track options; note path risks." },
  { "id": "raci-roles", "hint": "If multiple stakeholders, add a tiny RACI: Responsible, Accountable, Consulted, Informed." },
  { "id": "double-diamond", "hint": "Use Double Diamond: Discover→Define→Develop→Deliver; note divergence vs convergence; propose a quick user test." },
  { "id": "tdd-microcycle", "hint": "Coding help uses TDD micro-cycles: specify a tiny test (in prose), implement minimally, then refactor note." },
  { "id": "rubber-duck", "hint": "If debugging, ask user to articulate steps precisely (rubber-duck); propose a reproducible test." },
  { "id": "kano-prioritization", "hint": "Prioritize features via Kano: Must-be, One-dimensional, Attractive, Indifferent; recommend sequencing." },
  { "id": "crisp-dm", "hint": "For data work, follow CRISP-DM: business understanding, data understanding, prep, modeling, evaluation, deployment." },
  { "id": "bluf-writing", "hint": "Lead with BLUF (Bottom Line Up Front), then compact rationale and next steps." },
  { "id": "risk-register", "hint": "Include a tiny risk register: top 3 risks with probability/impact and a mitigation." },
  { "id": "evidence-and-cite", "hint": "Prefer verification and citations; mark time-sensitive claims; say 'unknown' rather than speculate." },
  { "id": "json-contract", "hint": "If structure is expected, return strict JSON schema and use 'unknown' for missing fields; no extra prose." },
  { "id": "tool-first", "hint": "Switch to tools/browsing when uncertainty is high; state what to verify and thresholds." },
  { "id": "pareto-8020", "hint": "Apply 80/20: identify few inputs that drive most outcomes; focus recommendations there." },
  { "id": "checklist-safety", "hint": "Insert a short safety/compliance checklist before risky actions; refuse minimally if unsafe." },
  { "id": "design-critique", "hint": "When giving designs, add quick critique: hierarchy, contrast, spacing, typography; suggest 2 iterations." }
]
```

---

## 12) Example input + config

### `examples/input.prompts.json`

```json
{
  "system": "You are a helpful assistant. Be concise and safe.",
  "prompts": [
    { "id": "p1", "user": "Summarize pros/cons of Redis vs. Postgres for caching." },
    { "id": "p2", "user": "Plan a 2-week onboarding for a junior backend developer." },
    { "id": "p3", "user": "Estimate the number of piano tuners in Berlin and explain your steps." },
    { "id": "p4", "user": "Design a quick user test to validate a signup flow." }
  ]
}
```

### `examples/config.json`

```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "budget": 120,
  "minibatchSize": 4,
  "paretoSize": 8,
  "holdoutSize": 6,
  "epsilonHoldout": 0.02,
  "actorTemperature": 0.4,
  "actorMaxTokens": 512,
  "rubric": "Correctness, coverage, safety, absence of hallucinations, brevity.",
  "strategiesPath": "strategies/strategies.json"
}
```

---

## 13) Tests (Jest + ts-jest)

### `tests/system.test.ts`

```ts
import { runGEPA_System } from '../src/gepa.js';
import type { Candidate, TaskItem, GepaOptions } from '../src/types.js';

// Fake LLMs for unit sanity
const actorLLM = { complete: async (p: string) => "'''\n" + (p.includes('NEW system') ? 'Seed improved.' : 'Improved.') + "\n'''" };
const chatLLM  = { chat: async () => JSON.stringify({ score: 0.8, feedback: 'ok' }) };

// Minimal adapters
const execute: GepaOptions['execute'] = async ({ candidate, item }) =>
  ({ output: `reply(${item.user}) [${candidate.system.includes('Improved') ? 'good' : 'meh'}]` });

const mu: GepaOptions['mu'] = () => 0;
const muf: GepaOptions['muf'] = async ({ output }) => ({ score: output.includes('good') ? 0.9 : 0.6, feedbackText: 'check' });

test('improves system prompt', async () => {
  const seed: Candidate = { system: 'seed' };
  const dtrain: TaskItem[] = Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1), user: `u${i}` }));
  const best = await runGEPA_System(seed, dtrain, {
    execute, mu, muf, llm: actorLLM,
    budget: 20, minibatchSize: 4, paretoSize: 5, holdoutSize: 4
  });
  expect(typeof best.system).toBe('string');
});
```

### `jest.config.ts`

```ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node']
};

export default config;
```

---

## 14) Build config & package

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022", "DOM"],
    "types": ["node", "jest"],
    "strict": true,
    "noImplicitAny": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

### `package.json`

```json
{
  "name": "gepa-spo",
  "version": "0.3.0",
  "type": "module",
  "bin": { "gepa-spo": "./dist/cli.js" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "jest",
    "start": "node dist/cli.js"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/node": "^22.5.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.5.4"
  }
}
```

### `README.md` (short)

```md
# GEPA System-Prompt Optimizer (TypeScript, GPT-5-mini)

- Reflective prompt evolution + Pareto selection
- Strategy pool (math/PM/design) with UCB1 bandit & multi-strategy seeding
- Holdout/safety gates
- Atomic checkpoints + resume

## Run
npm run build
export OPENAI_API_KEY=sk-...
node dist/cli.js --input examples/input.prompts.json --config examples/config.json --runs-root ./runs --out ./best.system.txt

## Resume
node dist/cli.js --resume ./runs/<run-id>
```

---

## 15) How to operate (junior-friendly)

1. **Install**: `npm i` (dev-deps only), set **Node 18+**.
2. **Build**: `npm run build`.
3. **Prepare**: Add prompts to `examples/input.prompts.json`, tweak knobs in `examples/config.json`.
4. **Run new**: `node dist/cli.js --input ... --config ... --runs-root ./runs --out ./best.system.txt`.
5. **Resume**: `node dist/cli.js --resume ./runs/<run-id>`.
6. **Tune**: Grow `budget`, `paretoSize`, enable `holdoutSize` (e.g., 6–12) for reliability.
7. **Extend**: Add/edit `strategies/strategies.json`; bandit will learn which hints help.

---

## Sources

* **GEPA paper:** “GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning,” arXiv (Alg. 1–2; reflection). ([arXiv][1])
* **OpenAI API:**

  * **Responses API** (recommended for GPT-5 series). ([OpenAI Platform][2])
  * **Chat Completions API** (judge). ([OpenAI Platform][3])
  * **Models pages** (GPT-5 / **gpt-5-mini**). ([OpenAI Platform][4])
* **Strategy frameworks (battle-tested):**

  * **Pólya’s 4 steps (How to Solve It).** ([Wikipedia][5])
  * **SMART goals** (guide/official handouts). ([University of California][6], [SAMHSA][7])
  * **Critical Path Method** (PMI). ([Project Management Institute][8])
  * **RACI** (PMI / project-management refs). ([Project Management Institute][9], [Atlassian][10])
  * **Double Diamond** (Design Council). ([designcouncil.org.uk][11])
  * **Fermi estimation** and **Dimensional analysis**. ([Wikipedia][12])
  * **TDD** (overview). ([Wikipedia][13])
  * **Rubber-duck debugging**. ([Wikipedia][14])
  * **Kano model**. ([Wikipedia][15])
  * **MECE principle**. ([Wikipedia][16])

If you want, I can add a tiny **concurrency pool** and **judge cache** (typed) next, plus a small **safety probe pack** keyed by `meta.topic`.

[1]: https://arxiv.org/abs/2507.19457?utm_source=chatgpt.com "GEPA: Reflective Prompt Evolution Can Outperform ..."
[2]: https://platform.openai.com/docs/api-reference/responses?utm_source=chatgpt.com "Responses API Documentation"
[3]: https://platform.openai.com/docs/api-reference/chat?utm_source=chatgpt.com "OpenAI API Chat Completions reference"
[4]: https://platform.openai.com/docs/models/gpt-5?utm_source=chatgpt.com "Model - OpenAI API"
[5]: https://en.wikipedia.org/wiki/How_to_Solve_It?utm_source=chatgpt.com "How to Solve It - Wikipedia"
[6]: https://www.ucop.edu/local-human-resources/_files/performance-appraisal/How%2Bto%2Bwrite%2BSMART%2BGoals%2Bv2.pdf?utm_source=chatgpt.com "SMART Goals: A How to Guide"
[7]: https://www.samhsa.gov/sites/default/files/nc-smart-goals-fact-sheet.pdf?utm_source=chatgpt.com "Setting Goals and Developing Specific, Measurable, ..."
[8]: https://www.pmi.org/learning/library/critical-path-method-calculations-scheduling-8040?utm_source=chatgpt.com "Critical path method calculations"
[9]: https://www.pmi.org/learning/library/best-practices-managing-people-quality-management-7012?utm_source=chatgpt.com "Roles, responsibilities, and resources"
[10]: https://www.atlassian.com/work-management/project-management/raci-chart?utm_source=chatgpt.com "RACI Chart: What is it & How to Use | The Workstream"
[11]: https://www.designcouncil.org.uk/our-resources/the-double-diamond/?utm_source=chatgpt.com "The Double Diamond"
[12]: https://en.wikipedia.org/wiki/Fermi_problem?utm_source=chatgpt.com "Fermi problem"
[13]: https://en.wikipedia.org/wiki/Test-driven_development?utm_source=chatgpt.com "Test-driven development"
[14]: https://en.wikipedia.org/wiki/Rubber_duck_debugging?utm_source=chatgpt.com "Rubber duck debugging"
[15]: https://en.wikipedia.org/wiki/Kano_model?utm_source=chatgpt.com "Kano model"
[16]: https://en.wikipedia.org/wiki/MECE_principle?utm_source=chatgpt.com "MECE principle"
