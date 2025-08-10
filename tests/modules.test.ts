import {
  isModular,
  isSingleSystem,
  getModuleCount,
  getModule,
  setModule,
  concatenateModules,
  serializeCandidate,
  deserializeCandidate,
  cloneCandidate,
  validateCandidate
} from '../src/modules.js';
import type { Candidate, Module } from '../src/types.js';

describe('modules.ts - utility functions', () => {
  const singleSystemCandidate: Candidate = { system: 'You are a helpful assistant.' };
  const modularCandidate: Candidate = {
    modules: [
      { id: 'personality', prompt: 'You are friendly and helpful.' },
      { id: 'instructions', prompt: 'Always provide accurate information.' }
    ]
  };

  describe('type guards', () => {
    test('isModular identifies modular candidates', () => {
      expect(isModular(singleSystemCandidate)).toBe(false);
      expect(isModular(modularCandidate)).toBe(true);
    });

    test('isSingleSystem identifies single-system candidates', () => {
      expect(isSingleSystem(singleSystemCandidate)).toBe(true);
      expect(isSingleSystem(modularCandidate)).toBe(false);
    });
  });

  describe('getModuleCount', () => {
    test('returns 1 for single-system candidates', () => {
      expect(getModuleCount(singleSystemCandidate)).toBe(1);
    });

    test('returns module count for modular candidates', () => {
      expect(getModuleCount(modularCandidate)).toBe(2);
    });
  });

  describe('getModule', () => {
    test('gets module from modular candidate', () => {
      const module = getModule(modularCandidate, 0);
      expect(module).toEqual({ id: 'personality', prompt: 'You are friendly and helpful.' });
    });

    test('gets system as module 0 from single-system candidate', () => {
      const module = getModule(singleSystemCandidate, 0);
      expect(module).toEqual({ id: 'system', prompt: 'You are a helpful assistant.' });
    });

    test('returns null for out-of-bounds index', () => {
      expect(getModule(modularCandidate, 5)).toBeNull();
      expect(getModule(singleSystemCandidate, 1)).toBeNull();
    });
  });

  describe('setModule', () => {
    test('sets module in modular candidate', () => {
      const newModule: Module = { id: 'personality', prompt: 'You are very friendly.' };
      const updated = setModule(modularCandidate, 0, newModule);
      expect(updated.modules![0]).toEqual(newModule);
      expect(updated.modules![1]).toEqual(modularCandidate.modules![1]); // unchanged
    });

    test('sets system in single-system candidate', () => {
      const newModule: Module = { id: 'system', prompt: 'You are a very helpful assistant.' };
      const updated = setModule(singleSystemCandidate, 0, newModule);
      expect(updated.system).toBe(newModule.prompt);
    });

    test('throws error for invalid index', () => {
      const newModule: Module = { id: 'test', prompt: 'test' };
      expect(() => setModule(singleSystemCandidate, 1, newModule)).toThrow();
    });
  });

  describe('concatenateModules', () => {
    test('returns system for single-system candidate', () => {
      expect(concatenateModules(singleSystemCandidate)).toBe('You are a helpful assistant.');
    });

    test('concatenates modules with double newlines', () => {
      const result = concatenateModules(modularCandidate);
      expect(result).toBe('You are friendly and helpful.\n\nAlways provide accurate information.');
    });

    test('throws error for invalid candidate', () => {
      const invalidCandidate = {} as Candidate;
      expect(() => concatenateModules(invalidCandidate)).toThrow();
    });
  });

  describe('serializeCandidate', () => {
    test('serializes single-system candidate as string', () => {
      const serialized = serializeCandidate(singleSystemCandidate);
      expect(serialized).toBe('You are a helpful assistant.');
    });

    test('serializes modular candidate as JSON', () => {
      const serialized = serializeCandidate(modularCandidate);
      const parsed = JSON.parse(serialized);
      expect(parsed.modules).toEqual(modularCandidate.modules);
    });

    test('throws error for invalid candidate', () => {
      const invalidCandidate = {} as Candidate;
      expect(() => serializeCandidate(invalidCandidate)).toThrow();
    });
  });

  describe('deserializeCandidate', () => {
    test('deserializes single-system string', () => {
      const serialized = 'You are a helpful assistant.';
      const candidate = deserializeCandidate(serialized);
      expect(candidate).toEqual(singleSystemCandidate);
    });

    test('deserializes modular JSON', () => {
      const serialized = JSON.stringify({ modules: modularCandidate.modules });
      const candidate = deserializeCandidate(serialized);
      expect(candidate).toEqual(modularCandidate);
    });

    test('handles malformed JSON as single system', () => {
      const serialized = 'You are a helpful assistant.';
      const candidate = deserializeCandidate(serialized);
      expect(candidate).toEqual(singleSystemCandidate);
    });
  });

  describe('cloneCandidate', () => {
    test('clones single-system candidate', () => {
      const cloned = cloneCandidate(singleSystemCandidate);
      expect(cloned).toEqual(singleSystemCandidate);
      expect(cloned).not.toBe(singleSystemCandidate); // different reference
    });

    test('clones modular candidate', () => {
      const cloned = cloneCandidate(modularCandidate);
      expect(cloned).toEqual(modularCandidate);
      expect(cloned).not.toBe(modularCandidate); // different reference
      expect(cloned.modules).not.toBe(modularCandidate.modules); // different reference
    });

    test('throws error for invalid candidate', () => {
      const invalidCandidate = {} as Candidate;
      expect(() => cloneCandidate(invalidCandidate)).toThrow();
    });
  });

  describe('validateCandidate', () => {
    test('validates single-system candidate', () => {
      expect(() => validateCandidate(singleSystemCandidate)).not.toThrow();
    });

    test('validates modular candidate', () => {
      expect(() => validateCandidate(modularCandidate)).not.toThrow();
    });

    test('throws error for candidate without system or modules', () => {
      const invalidCandidate = {} as Candidate;
      expect(() => validateCandidate(invalidCandidate)).toThrow();
    });

    test('throws error for modular candidate with empty modules', () => {
      const invalidCandidate: Candidate = { modules: [] };
      expect(() => validateCandidate(invalidCandidate)).toThrow();
    });

    test('throws error for modular candidate with invalid modules', () => {
      const invalidCandidate: Candidate = { 
        modules: [{ id: '', prompt: 'test' }] 
      };
      expect(() => validateCandidate(invalidCandidate)).toThrow();
    });
  });
});
