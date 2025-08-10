import { seedPopulation } from '../src/seeding.js';
describe('seedPopulation', () => {
    const llm = { complete: async (p) => (p.includes('Strategy hint') ? "'''seeded'''" : "'''noop'''") };
    const execute = async ({ candidate, item }) => ({ output: `${candidate.system}:${item.user}` });
    const muf = async ({ output }) => ({ score: output.includes('seeded') ? 1 : 0.5, feedbackText: 'ok' });
    test('returns up to 5 candidates sorted by uplift', async () => {
        const res = await seedPopulation({
            seed: { system: 'seed' },
            screen: [{ id: '1', user: 'u1' }],
            strategies: [{ id: 's1', hint: 'h' }, { id: 's2', hint: 'h2' }],
            K: 2,
            execute: execute,
            muf: muf,
            llm: llm
        });
        expect(res.candidates.length).toBeGreaterThanOrEqual(1);
        expect(res.candidates[0]).toHaveProperty('system');
        expect(res.usedCalls).toBeGreaterThanOrEqual(1);
    });
});
