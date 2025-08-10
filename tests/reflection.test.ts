import { buildReflectionPrompt, proposeNewSystem } from '../src/reflection.js';

describe('buildReflectionPrompt', () => {
  test('includes system and examples', () => {
    const p = buildReflectionPrompt('seed', [{ user: 'u', output: 'o', feedback: 'f' }], 'hint');
    expect(p).toContain("'''\nseed\n'''");
    expect(p).toContain('hint');
    expect(p).toContain('USER:');
  });
});

describe('proposeNewSystem', () => {
  test('extracts triple-quoted content', async () => {
    const llm = { complete: async () => "'''\nnew\n'''" };
    const out = await proposeNewSystem(llm as any, 'seed', [], '');
    expect(out).toBe('new');
  });

  test('falls back to raw and trims', async () => {
    const llm = { complete: async () => '  raw  ' };
    const out = await proposeNewSystem(llm as any, 'seed', [], '');
    expect(out).toBe('raw');
  });
});


