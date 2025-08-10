import { runGEPA_System } from '../src/gepa.js';
// Fake LLMs for unit sanity
const actorLLM = { complete: async (p) => "'''\n" + (p.includes('NEW system') ? 'Seed improved.' : 'Improved.') + "\n'''" };
const chatLLM = { chat: async () => JSON.stringify({ score: 0.8, feedback: 'ok' }) };
// Minimal adapters
const execute = async ({ candidate, item }) => ({ output: `reply(${item.user}) [${candidate.system.includes('Improved') ? 'good' : 'meh'}]` });
const mu = () => 0;
const muf = async ({ output }) => ({ score: output.includes('good') ? 0.9 : 0.6, feedbackText: 'check' });
describe('runGEPA_System', () => {
    test('returns a candidate with a system string', async () => {
        const seed = { system: 'seed' };
        const dtrain = Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1), user: `u${i}` }));
        const best = await runGEPA_System(seed, dtrain, {
            execute, mu, muf, llm: actorLLM,
            budget: 20, minibatchSize: 4, paretoSize: 5, holdoutSize: 4
        });
        expect(typeof best.system).toBe('string');
    });
});
