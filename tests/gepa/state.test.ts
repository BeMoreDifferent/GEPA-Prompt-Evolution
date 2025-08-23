import { initializeState } from '../../src/gepa/state.js';
import type { Candidate, TaskItem, GepaOptions } from '../../src/types.js';
import { silentLogger } from '../../src/logger.js';
import { BudgetTracker } from '../../src/budget.js';

describe('initializeState', () => {
  const seed: Candidate = { system: 'test' };
  const dtrain: TaskItem[] = [
    { id: '1', user: 'a' },
    { id: '2', user: 'b' },
    { id: '3', user: 'c' },
    { id: '4', user: 'd' },
    { id: '5', user: 'e' },
  ];
  const opts: GepaOptions = {
    execute: async () => ({ output: 'test' }),
    mu: () => 0.5,
    muf: async () => ({ score: 0.5, feedbackText: 'test' }),
    llm: { complete: async () => 'test' },
    budget: 100,
    minibatchSize: 2,
    paretoSize: 2,
  };
  const logger = silentLogger;
  const budgetTracker = new BudgetTracker(100, true);

  test('initializes state correctly', async () => {
    const { state, P, S, Dpareto, Dhold, Dfb } = await initializeState(
      seed,
      dtrain,
      opts,
      undefined,
      logger,
      budgetTracker
    );

    expect(state.iter).toBe(0);
    expect(P.length).toBe(1);
    expect(S.length).toBe(1);
    expect(Dpareto.length).toBe(2);
    expect(Dhold.length).toBe(0);
    expect(Dfb.length).toBe(3);
  });

  test('handles holdout set', async () => {
    const optsWithHoldout = { ...opts, holdoutSize: 2 };
    const { Dpareto, Dhold, Dfb } = await initializeState(
      seed,
      dtrain,
      optsWithHoldout,
      undefined,
      logger,
      budgetTracker
    );

    expect(Dpareto.length).toBe(2);
    expect(Dhold.length).toBe(2);
    expect(Dfb.length).toBe(1);
  });
});
