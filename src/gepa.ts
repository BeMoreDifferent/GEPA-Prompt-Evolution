import { selectCandidate } from './selection.js';
import { proposeNewSystem, type JudgedExample } from './reflection.js';
import { UCB1 } from './bandit.js';
import { seedPopulation, type StrategyDef } from './seeding.js';
import type {
  Candidate, TaskItem, GepaOptions, GEPAState
} from './types.js';
import * as fs from 'node:fs/promises';
import { type Logger, silentLogger } from './logger.js';

type PersistHook = (state: GEPAState, iterPayload: Record<string, unknown>) => Promise<void>;

export interface RunPersist {
  state?: GEPAState;
  onCheckpoint?: PersistHook;
  logger?: Logger;
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
  const logger: Logger = persist?.logger ?? silentLogger;
  logger.step('GEPA start', `budget=${budget}, pareto=${nPareto}, minibatch=${b}`);

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
  logger.info(`Split: pareto=${Dpareto.length}, holdout=${Dhold.length}, feedback=${Dfb.length}`);

  // Rebuild P and S
  const P: Candidate[] = state.Psystems.map(s => ({ system: s }));
  const S: number[][] = state.S.length ? state.S : (state.S = []);

  // Seed Pareto row for initial candidate if missing
  if (S.length === 0) {
    logger.step('Init Pareto row', `k=0 over ${Dpareto.length} items`);
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
    logger.step('Seeding population');
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
    logger.info(`Seeded +${seeded.length - 1} candidates (screen=${screen.length})`);
    if (persist?.onCheckpoint) await persist.onCheckpoint(state, { iter: state.iter, seeded: true });
  }

  // Helper: holdout average judge score
  const avgHoldout = async (cand: Candidate): Promise<number> => {
    if (!Dhold.length) return 0;
    const scores: number[] = [];
    for (const item of Dhold) {
      const { output } = await execute({ candidate: cand, item });
      const jf = await opts.muf({ item, output });
      scores.push(jf.score);
    }
    return avg(scores);
  };

  while (state.budgetLeft > 0) {
    const k = selectCandidate(P, S);
    const parent = P[k];
    logger.step(`Iter ${state.iter + 1}`, `pick k=${k}`);

    // Minibatch over feedback set
    const M = sampleMinibatch(Dfb, b);
    const before: Array<{ id: string; score: number; feedback: string; output: string }> = [];
    for (const item of M) {
      const { output, traces } = await execute({ candidate: parent, item });
      const f = await opts.muf({ item, output, traces: traces ?? null });
      before.push({ id: item.id, score: f.score, feedback: f.feedbackText, output });
      if (--state.budgetLeft <= 0) break;
    }
    const sigma = avg(before.map(x => x.score));
    if (state.budgetLeft <= 0) break;

    // Mutate with chosen strategy
    const chosenId = bandit.pick();
    logger.info(`Strategy: ${chosenId}; minibatch size=${M.length}`);
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
      const f = await opts.muf({ item, output, traces: traces ?? null });
      afterScores.push(f.score);
      if (--state.budgetLeft <= 0) break;
    }
    const sigmaP = avg(afterScores);

    // Reward bandit: map [-1,1] -> [0,1]
    const reward = Math.max(0, Math.min(1, (sigmaP - sigma + 1) / 2));
    bandit.update(chosenId, reward);
    logger.info(`Uplift: before=${sigma.toFixed(3)} after=${sigmaP.toFixed(3)} reward=${reward.toFixed(3)} budgetLeft=${state.budgetLeft}`);

    // Holdout gate
    let passHold = true;
    if (Dhold.length) {
      const holdParent = await avgHoldout(parent);
      const holdChild = await avgHoldout(child);
      passHold = holdChild + epsilonHoldout >= holdParent;
      logger.debug(`Holdout: parent=${holdParent.toFixed(3)} child=${holdChild.toFixed(3)} pass=${passHold}`);
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
        return opts.mu(output, item.meta ?? null);
      }));
      S.push(row);
      state.S = S;
      state.bestIdx = argmax(S.map(r => avg(r)));
      logger.step('Accepted', `k=${P.length - 1} bestIdx=${state.bestIdx}`);
    } else {
      logger.warn('Rejected');
    }

    if (persist?.onCheckpoint) {
      await persist.onCheckpoint(state, iterPayload);
      logger.debug('Checkpoint saved');
    }
    state.bandit = bandit.serialize();
  }

  logger.step('GEPA done', `bestIdx=${state.bestIdx}`);
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


