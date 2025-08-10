import { isModular, isSingleSystem, concatenateModules, serializeCandidate, deserializeCandidate } from '../src/modules.js';
import { buildModuleReflectionPrompt } from '../src/reflection.js';
import type { Candidate } from '../src/types.js';

describe('modular integration', () => {
  test('modular candidate round-trip serialization', () => {
    const modularCandidate: Candidate = {
      modules: [
        { id: 'personality', prompt: 'You are friendly.' },
        { id: 'instructions', prompt: 'Provide accurate info.' }
      ]
    };

    expect(isModular(modularCandidate)).toBe(true);
    expect(isSingleSystem(modularCandidate)).toBe(false);

    const serialized = serializeCandidate(modularCandidate);
    const deserialized = deserializeCandidate(serialized);

    expect(isModular(deserialized)).toBe(true);
    expect(deserialized.modules).toEqual(modularCandidate.modules);
  });

  test('single system candidate round-trip serialization', () => {
    const singleCandidate: Candidate = {
      system: 'You are a helpful assistant.'
    };

    expect(isSingleSystem(singleCandidate)).toBe(true);
    expect(isModular(singleCandidate)).toBe(false);

    const serialized = serializeCandidate(singleCandidate);
    const deserialized = deserializeCandidate(serialized);

    expect(isSingleSystem(deserialized)).toBe(true);
    expect(deserialized.system).toBe(singleCandidate.system);
  });

  test('concatenate modules works correctly', () => {
    const modularCandidate: Candidate = {
      modules: [
        { id: 'personality', prompt: 'You are friendly.' },
        { id: 'instructions', prompt: 'Provide accurate info.' }
      ]
    };

    const concatenated = concatenateModules(modularCandidate);
    expect(concatenated).toBe('You are friendly.\n\nProvide accurate info.');
  });

  test('buildModuleReflectionPrompt creates valid prompt', () => {
    const modules = [
      { id: 'personality', prompt: 'You are friendly.' },
      { id: 'instructions', prompt: 'Provide accurate info.' }
    ];

    const prompt = buildModuleReflectionPrompt(
      modules[0],
      modules,
      0,
      [{ user: 'test', output: 'test', feedback: 'test' }],
      'test hint'
    );

    expect(prompt).toContain('You will REWRITE a specific module in a multi-module system.');
    expect(prompt).toContain('Strategy hint: test hint');
    expect(prompt).toContain('>>> Module 1 (personality): CURRENT MODULE TO UPDATE');
    expect(prompt).toContain('Module 2 (instructions): PRESERVE AS-IS');
    expect(prompt).toContain('You are friendly.');
  });
});
