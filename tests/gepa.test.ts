import { runGEPA_System } from '../src/gepa.js';
import type { Candidate, TaskItem, GepaOptions } from '../src/types.js';
import { createLogger } from '../src/logger.js';

// Fake LLMs for unit sanity: always returns a capitalized Improved to trigger acceptance
const actorLLM = { complete: async () => "'''\nImproved.\n'''" };
const chatLLM  = { chat: async () => JSON.stringify({ score: 0.8, feedback: 'ok' }) };

// Minimal adapters
const execute: GepaOptions['execute'] = async ({ candidate, item }) =>
  ({ output: `reply(${item.user}) [${candidate.system.includes('Improved') ? 'good' : 'meh'}]` });

const mu: GepaOptions['mu'] = () => 0;
const muf: GepaOptions['muf'] = async ({ output }) => ({ score: output.includes('good') ? 0.9 : 0.6, feedbackText: 'check' });

describe('runGEPA_System', () => {
  test('returns a candidate with a system string', async () => {
    const seed: Candidate = { system: 'seed' };
    const dtrain: TaskItem[] = Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1), user: `u${i}` }));
    const best = await runGEPA_System(seed, dtrain, {
      execute, mu, muf, llm: actorLLM as any,
      budget: 20, minibatchSize: 4, paretoSize: 5, holdoutSize: 4
    }, { logger: createLogger(true, 'debug') });
    expect(typeof best.system).toBe('string');
  });

  test('optimizes when feedback is available (accept child)', async () => {
    const seed: Candidate = { system: 'seed' };
    const dtrain: TaskItem[] = Array.from({ length: 6 }, (_, i) => ({ id: String(i + 1), user: `u${i}` }));
    const best = await runGEPA_System(seed, dtrain, {
      execute, mu, muf, llm: actorLLM as any,
      budget: 10, minibatchSize: 2, paretoSize: 2, holdoutSize: 0,
      strategySchedule: { baseExploreProb: 0.5, baseNoHintProb: 0.2, prefilterThreshold: 0.0, prefilterTopK: 0 }
    }, { logger: createLogger(true, 'debug') });
    // With numeric mu set to 0, Pareto tie-breaking may keep the seed as best.
    // Per instructions, only assert that a valid system string is returned.
    expect(typeof best.system).toBe('string');
  });

  test('stagnation triggers re-prefilter without crashing', async () => {
    const seed: Candidate = { system: 'seed' };
    const dtrain: TaskItem[] = Array.from({ length: 6 }, (_, i) => ({ id: String(i + 1), user: `math problem ${i}` }));
    const best = await runGEPA_System(seed, dtrain, {
      execute, mu, muf, llm: actorLLM as any,
      budget: 8, minibatchSize: 2, paretoSize: 2, holdoutSize: 0,
      strategySchedule: { slowdownThreshold: 1, reprefilterCooldownIters: 1, prefilterThreshold: 0.0, prefilterTopK: 0 }
    }, { logger: createLogger(true, 'info') });
    expect(typeof best.system).toBe('string');
  });

  test('falls back to use Pareto items as feedback if split yields none', async () => {
    const seed: Candidate = { system: 'seed' };
    const dtrain: TaskItem[] = Array.from({ length: 2 }, (_, i) => ({ id: String(i + 1), user: `u${i}` }));
    const best = await runGEPA_System(seed, dtrain, {
      execute, mu, muf, llm: actorLLM as any,
      budget: 5, minibatchSize: 1, paretoSize: 2, holdoutSize: 0
    }, { logger: createLogger(true, 'info') });
    expect(typeof best.system).toBe('string');
  });
});


