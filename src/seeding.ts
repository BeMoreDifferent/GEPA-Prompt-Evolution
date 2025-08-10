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
  /** Optional budget guard: max total LLM calls allowed during seeding (mutations + evals) */
  budgetLeft?: number;
}

/** Generate seeded candidates with top-K strategies and keep the top few by average judge score */
export async function seedPopulation({
  seed, screen, strategies, K, execute, muf, llm, budgetLeft
}: SeedArgs): Promise<{ candidates: Array<Candidate & { _via: string; _uplift: number }>; usedCalls: number }> {
  const out: Array<Candidate & { _via: string; _uplift: number }> = [{ system: seed.system, _via: 'seed', _uplift: 0 }];
  let usedCalls = 0;

  for (const s of strategies.slice(0, K)) {
    if (budgetLeft !== undefined && budgetLeft <= 0) break;
    const ex: JudgedExample[] = screen.map(x => ({ user: x.user, output: '', feedback: 'Initial strategy seeding' }));
    const sys2 = await proposeNewSystem(llm, seed.system, ex, s.hint);
    usedCalls += 1; if (budgetLeft !== undefined) budgetLeft -= 1; // propose call
    const scores: number[] = [];
    for (const item of screen) {
      if (budgetLeft !== undefined && budgetLeft <= 0) break;
      const { output, traces } = await execute({ candidate: { system: sys2 }, item });
      const f = await muf({ item, output, traces: { ...(traces ?? {}), system: sys2 } });
      scores.push(f.score);
      usedCalls += 1; if (budgetLeft !== undefined) budgetLeft -= 1;
    }
    out.push({ system: sys2, _via: s.id, _uplift: avg(scores) });
  }

  out.sort((a, b) => b._uplift - a._uplift);
  return { candidates: out.slice(0, Math.min(5, out.length)), usedCalls };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);


