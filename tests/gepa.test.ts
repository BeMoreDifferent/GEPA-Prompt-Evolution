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

describe('runGEPA_System', () => {
  test('returns a candidate with a system string', async () => {
    const seed: Candidate = { system: 'seed' };
    const dtrain: TaskItem[] = Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1), user: `u${i}` }));
    const best = await runGEPA_System(seed, dtrain, {
      execute, mu, muf, llm: actorLLM as any,
      budget: 20, minibatchSize: 4, paretoSize: 5, holdoutSize: 4
    });
    expect(typeof best.system).toBe('string');
  });
});


