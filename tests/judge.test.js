import { buildJudgePrompt, judgeScore } from '../src/judge.js';
describe('buildJudgePrompt', () => {
    test('contains rubric and json instruction', () => {
        const p = buildJudgePrompt('r');
        expect(p).toContain('Rubric:');
        expect(p).toContain('ONLY JSON');
    });
});
describe('judgeScore', () => {
    test('parses json safely', async () => {
        const chat = { chat: async () => JSON.stringify({ score: 0.8, feedback: 'good' }) };
        const j = await judgeScore(chat, 'r', 's', 'u', 'a');
        expect(j.score).toBeCloseTo(0.8);
    });
    test('handles non-json output', async () => {
        const chat = { chat: async () => 'oops' };
        const j = await judgeScore(chat, 'r', 's', 'u', 'a');
        expect(j.score).toBe(0);
    });
});
