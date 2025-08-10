import { runGEPA_System } from '../src/gepa.js';
import type { Candidate, TaskItem, GepaOptions } from '../src/types.js';

/**
 * M1 — Unify score matrix S to a single scorer (μ̂)
 * Sentinel test: when mu=0.37 and muf=0.81, all entries in S must equal the chosen scorer.
 */

const SEED: Candidate = { system: 'seed' };
const D: TaskItem[] = Array.from({ length: 6 }).map((_, i) => ({ id: `p${i+1}`, user: `u${i+1}` }));

function makeOpts(scoreForPareto: 'muf' | 'mu', overrides?: Partial<GepaOptions>): GepaOptions {
  return {
    execute: async ({ candidate }) => ({ output: `out:${candidate.system}`, traces: { system: candidate.system } }),
    // numeric mu ignores output content and uses sentinel value
    mu: () => 0.37,
    // judge muf also ignores content and uses sentinel value
    muf: () => ({ score: 0.81, feedbackText: 'x' }),
    llm: { complete: async () => 'child' },
    budget: 15, // ensure seeding occurs and rows are added for seeded candidates
    minibatchSize: 1,
    paretoSize: 3,
    holdoutSize: 0,
    epsilonHoldout: 0.0,
    scoreForPareto,
    ...overrides
  };
}

test('S uses muf when scoreForPareto=muf (default) across init and seeding rows', async () => {
  const opts = makeOpts('muf');
  const Srows: number[][] = [];
  const best = await runGEPA_System(SEED, D, opts, {
    onCheckpoint: async (state) => { Srows.push(...state.S.map(r => [...r])); }
  });
  expect(best.system).toBeDefined();
  // Expect all numbers in S to be exactly 0.81
  for (const row of Srows) {
    for (const v of row) expect(v).toBeCloseTo(0.81, 10);
  }
});

test('S uses mu when scoreForPareto=mu across init and seeding rows', async () => {
  const opts = makeOpts('mu');
  const Srows: number[][] = [];
  const best = await runGEPA_System(SEED, D, opts, {
    onCheckpoint: async (state) => { Srows.push(...state.S.map(r => [...r])); }
  });
  expect(best.system).toBeDefined();
  // Expect all numbers in S to be exactly 0.37
  for (const row of Srows) {
    for (const v of row) expect(v).toBeCloseTo(0.37, 10);
  }
});

test('Post-accept rows also use muf when configured', async () => {
  const opts = makeOpts('muf', {
    budget: 12,
    minibatchSize: 1,
    paretoSize: 2,
    // Force acceptance by making child higher-scoring than parent via traces.system
    muf: ({ traces }) => ({ score: (traces as any)?.system === 'child' ? 0.90 : 0.80, feedbackText: 'x' })
  });
  const Srows: number[][] = [];
  const best = await runGEPA_System(SEED, D, opts, {
    onCheckpoint: async (state) => { Srows.push(...state.S.map(r => [...r])); }
  });
  expect(best.system).toBeDefined();
  // All S values must come from muf (0.80 or 0.90), and none from mu (0.37)
  for (const row of Srows) {
    for (const v of row) {
      expect([0.80, 0.90]).toContainEqual(Number(v.toFixed(2)));
      expect(v).not.toBeCloseTo(0.37, 10);
    }
  }
});


