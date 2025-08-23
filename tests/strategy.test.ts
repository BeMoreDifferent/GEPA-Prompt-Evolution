import { prefilterStrategies } from '../src/strategy.js';

describe('prefilterStrategies', () => {
  const fakeLLM = {
    complete: async () => JSON.stringify({ s1: 0.9, s2: 0.1 })
  } as any;

  test('keeps strategies above threshold and sorts by score', async () => {
    const strategies = [
      { id: 's1', hint: 'math reasoning' },
      { id: 's2', hint: 'planning' }
    ];
    const res = await prefilterStrategies(fakeLLM, strategies as any, ['a task'], { threshold: 0.2, topK: 0 });
    expect(res.kept.map(s => s.id)).toEqual(['s1', 's2']);
    expect(Object.keys(res.scores)).toEqual(['s1', 's2']);
  });

  test('combines LLM score with global log score', async () => {
    const strategies = [
      { id: 's1', hint: 'math reasoning' },
      { id: 's2', hint: 'planning' }
    ];
    const log = {
      s1: { id: 's1', runs: 10, totalReward: 2 }, // avg = 0.2
      s2: { id: 's2', runs: 10, totalReward: 8 }, // avg = 0.8
    };
    const res = await prefilterStrategies(fakeLLM, strategies as any, ['a task'], { threshold: 0.2, topK: 0, log, logWeight: 0.5 });

    // s1: 0.5 * 0.9 (llm) + 0.5 * 0.2 (log) = 0.45 + 0.1 = 0.55
    // s2: 0.5 * 0.1 (llm) + 0.5 * 0.8 (log) = 0.05 + 0.4 = 0.45
    expect(res.kept.map(s => s.id)).toEqual(['s1', 's2']);
    expect(res.scores['s1']).toBeCloseTo(0.55);
    expect(res.scores['s2']).toBeCloseTo(0.45);
  });
});


