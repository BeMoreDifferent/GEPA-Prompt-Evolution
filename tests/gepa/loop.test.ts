import { runOptimizationLoop } from '../../src/gepa/loop.js';
import type { LoopContext } from '../../src/gepa/loop.js';
import { silentLogger } from '../../src/logger.js';
import { BudgetTracker } from '../../src/budget.js';
import { UCB1 } from '../../src/bandit.js';

describe('runOptimizationLoop', () => {
  test('runs without throwing an error', async () => {
    const context: LoopContext = {
      state: {
        version: 2,
        budgetLeft: 10,
        iter: 0,
        Psystems: ['{"system":"test"}'],
        S: [[0.5]],
        DparetoIdx: [],
        DfbIdx: [],
        DholdIdx: [],
        bestIdx: 0,
        seeded: false,
        bandit: null,
      },
      P: [{ system: 'test' }],
      S: [[0.5]],
      Dfb: [],
      Dhold: [],
      dtrain: [],
      opts: {
        execute: async () => ({ output: 'test' }),
        mu: () => 0.5,
        muf: async () => ({ score: 0.5, feedbackText: 'test' }),
        llm: { complete: async () => 'test' },
        budget: 10,
        minibatchSize: 1,
        paretoSize: 1,
      },
      budgetTracker: new BudgetTracker(10, true),
      logger: silentLogger,
      strategiesRaw: [],
      activeStrategies: [],
      bandit: new UCB1([]),
      scheduleOpts: {
        windowSize: 8,
        slowdownThreshold: 0.01,
        baseExploreProb: 0.1,
        maxExploreProb: 0.6,
        baseNoHintProb: 0.15,
        maxNoHintProb: 0.4,
        defaultCoreTopK: 6,
        prefilterThreshold: 0.3,
        prefilterTopK: 10,
        reprefilterCooldownIters: 6,
      },
      upliftWindow: [],
      pushUplift: () => {},
      recentAvgUplift: () => 0,
      calcExploreProb: () => 0.1,
      calcNoHintProb: () => 0.15,
      lastPrefilterIter: 0,
      reprefilterCooldown: 6,
      triedTriplets: [],
      avgHoldout: async () => 0.5,
      scoreParetoRow: async () => [0.5],
      previewTexts: [],
      prefilterCfg: {},
    };

    await expect(runOptimizationLoop(context)).resolves.not.toThrow();
  });
});
