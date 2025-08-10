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


