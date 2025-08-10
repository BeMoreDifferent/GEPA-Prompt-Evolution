import { runGEPA_System } from '../src/gepa.js';
import type { Candidate, TaskItem, GepaOptions } from '../src/types.js';
import { createLogger } from '../src/logger.js';

// No-op actor/judge to control budget consumption deterministically
const actorLLM = { complete: async () => 'ok' };

const execute: GepaOptions['execute'] = async ({ candidate, item }) => {
  return { output: `o(${item.id})` };
};
const mu: GepaOptions['mu'] = () => 0;
const muf: GepaOptions['muf'] = async () => ({ score: 0.5, feedbackText: 'n' });

describe('Budget invariant scaffold', () => {
  test('budgetLeft never negative with noop execute/muf', async () => {
    const seed: Candidate = { system: 's' };
    const dtrain: TaskItem[] = Array.from({ length: 5 }, (_, i) => ({ id: String(i + 1), user: `u${i}` }));

    // Track budgetLeft via checkpoint hook
    const seen: number[] = [];
    const best = await runGEPA_System(seed, dtrain, {
      execute, mu, muf, llm: actorLLM as any,
      budget: 7, minibatchSize: 2, paretoSize: 3, holdoutSize: 0
    }, {
      logger: createLogger(false, 'error'),
      onCheckpoint: async (state) => { seen.push(state.budgetLeft); }
    });

    expect(typeof best.system).toBe('string');
    expect(seen.length).toBeGreaterThanOrEqual(0);
    for (const b of seen) expect(b).toBeGreaterThanOrEqual(0);
  });
});


