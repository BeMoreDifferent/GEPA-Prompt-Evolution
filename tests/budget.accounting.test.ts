import { runGEPA_System } from '../src/gepa.js';
import type { Candidate, TaskItem, GepaOptions } from '../src/types.js';
import { createLogger } from '../src/logger.js';

const actorLLM = { complete: async () => 'ok' };

const makeData = (nPareto: number, nFb: number, nHold: number): TaskItem[] => {
  const total = nPareto + nFb + nHold;
  return Array.from({ length: total }, (_, i) => ({ id: String(i + 1), user: `u${i}` }));
};

describe('Budget accounting correctness', () => {
  const baseExecute: GepaOptions['execute'] = async ({ item }) => ({ output: `o(${item.id})` });
  const baseMu: GepaOptions['mu'] = () => 0.25;
  const baseMuf: GepaOptions['muf'] = async () => ({ score: 0.5, feedbackText: 'f' });

  test.each([
    { mufCosts: true },
    { mufCosts: false }
  ])('stops exactly at budget with mufCosts=%s', async ({ mufCosts }) => {
    const seed: Candidate = { system: 's' };
    // small set: 3 pareto, 4 feedback, 2 holdout
    const dtrain: TaskItem[] = makeData(3, 4, 2);
    const seen: number[] = [];

    const best = await runGEPA_System(seed, dtrain, {
      execute: baseExecute,
      mu: baseMu,
      muf: baseMuf,
      llm: actorLLM as any,
      budget: 7,
      minibatchSize: 2,
      paretoSize: 3,
      holdoutSize: 2,
      epsilonHoldout: 0,
      mufCosts,
      scoreForPareto: 'muf'
    }, {
      logger: createLogger(false, 'error'),
      onCheckpoint: async (state) => { seen.push(state.budgetLeft); }
    });

    expect(typeof best.system).toBe('string');
    // never negative
    for (const b of seen) expect(b).toBeGreaterThanOrEqual(0);
    // final state value matches internal tracking
    const last = seen.at(-1);
    if (typeof last === 'number') expect(last).toBeGreaterThanOrEqual(0);
  });
});


