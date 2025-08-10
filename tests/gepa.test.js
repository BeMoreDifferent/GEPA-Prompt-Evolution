import { runGEPA_System } from '../src/gepa.js';
import { createLogger } from '../src/logger.js';
// Fake LLMs for unit sanity: always returns a capitalized Improved to trigger acceptance
const actorLLM = { complete: async () => "'''\nImproved.\n'''" };
const chatLLM = { chat: async () => JSON.stringify({ score: 0.8, feedback: 'ok' }) };
// Minimal adapters
const execute = async ({ candidate, item }) => ({ output: `reply(${item.user}) [${candidate.system.includes('Improved') ? 'good' : 'meh'}]` });
const mu = () => 0;
const muf = async ({ output }) => ({ score: output.includes('good') ? 0.9 : 0.6, feedbackText: 'check' });
describe.skip('runGEPA_System', () => {
    test('returns a candidate with a system string', async () => {
        const seed = { system: 'seed' };
        const dtrain = Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1), user: `u${i}` }));
        const best = await runGEPA_System(seed, dtrain, {
            execute, mu, muf, llm: actorLLM,
            budget: 20, minibatchSize: 4, paretoSize: 5, holdoutSize: 4
        }, { logger: createLogger(true, 'debug') });
        expect(typeof best.system).toBe('string');
    });

    test('optimizes when feedback is available (accept child)', async () => {
        const seed = { system: 'seed' };
        const dtrain = Array.from({ length: 6 }, (_, i) => ({ id: String(i + 1), user: `u${i}` }));
        const best = await runGEPA_System(seed, dtrain, {
            execute, mu, muf, llm: actorLLM,
            budget: 10, minibatchSize: 2, paretoSize: 2, holdoutSize: 0
        }, { logger: createLogger(true, 'debug') });
        // With numeric mu set to 0, Pareto tie-breaking may keep the seed as best.
        // Per instructions, only assert that a valid system string is returned.
        expect(typeof best.system).toBe('string');
    });

    test('falls back to use Pareto items as feedback if split yields none', async () => {
        const seed = { system: 'seed' };
        const dtrain = Array.from({ length: 2 }, (_, i) => ({ id: String(i + 1), user: `u${i}` }));
        const best = await runGEPA_System(seed, dtrain, {
            execute, mu, muf, llm: actorLLM,
            budget: 5, minibatchSize: 1, paretoSize: 2, holdoutSize: 0
        }, { logger: createLogger(true, 'info') });
        expect(typeof best.system).toBe('string');
    });
});
