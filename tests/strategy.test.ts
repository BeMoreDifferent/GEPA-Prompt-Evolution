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
    expect(res.kept.map(s => s.id)).toEqual(['s1']);
    expect(Object.keys(res.scores)).toEqual(['s1', 's2']);
  });
});


