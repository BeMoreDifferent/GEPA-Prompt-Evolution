import { jest } from '@jest/globals';
import { parseInput } from '../src/cli.js';

// Mock dependencies
jest.mock('../src/gepa.js');
jest.mock('../src/llm_openai.js');
jest.mock('../src/judge.js');
jest.mock('../src/persist.js');
jest.mock('node:fs/promises');
jest.mock('node:path');

describe('CLI modules fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('parseInput function', () => {
    test('handles input with system only (backward compatibility)', () => {
      const inputRaw = {
        system: 'You are a helpful assistant.',
        prompts: [
          { id: 'p1', user: 'What is 2+2?' },
          { id: 'p2', user: 'What is the capital of France?' }
        ]
      };

      const result = parseInput(inputRaw);

      expect(result.system).toBe('You are a helpful assistant.');
      expect(result.prompts).toEqual([
        { id: 'p1', user: 'What is 2+2?' },
        { id: 'p2', user: 'What is the capital of France?' }
      ]);
    });

    test('handles input with modules only', () => {
      const inputRaw = {
        modules: [
          { id: 'intro', prompt: 'You are a helpful assistant.' },
          { id: 'safety', prompt: 'Always be safe and accurate.' }
        ],
        prompts: [
          { id: 'p1', user: 'What is 2+2?' },
          { id: 'p2', user: 'What is the capital of France?' }
        ]
      };

      const result = parseInput(inputRaw);

      expect(result.system).toBe('You are a helpful assistant.\n\nAlways be safe and accurate.');
      expect(result.prompts).toEqual([
        { id: 'p1', user: 'What is 2+2?' },
        { id: 'p2', user: 'What is the capital of France?' }
      ]);
    });

    test('handles input with both system and modules (system takes precedence)', () => {
      const inputRaw = {
        system: 'You are a helpful assistant.',
        modules: [
          { id: 'intro', prompt: 'This should be ignored.' },
          { id: 'safety', prompt: 'This should also be ignored.' }
        ],
        prompts: [
          { id: 'p1', user: 'What is 2+2?' }
        ]
      };

      const result = parseInput(inputRaw);

      expect(result.system).toBe('You are a helpful assistant.');
      expect(result.prompts).toEqual([
        { id: 'p1', user: 'What is 2+2?' }
      ]);
    });

    test('validates module structure - missing id', () => {
      const inputRaw = {
        modules: [
          { id: 'intro', prompt: 'You are a helpful assistant.' },
          { id: '', prompt: 'Invalid module without id' } // Invalid module
        ],
        prompts: [
          { id: 'p1', user: 'What is 2+2?' }
        ]
      };

      expect(() => parseInput(inputRaw)).toThrow('Each module must have a string "id"');
    });

    test('validates module structure - missing prompt', () => {
      const inputRaw = {
        modules: [
          { id: 'intro', prompt: 'You are a helpful assistant.' },
          { id: 'safety' } // Missing prompt
        ],
        prompts: [
          { id: 'p1', user: 'What is 2+2?' }
        ]
      };

      expect(() => parseInput(inputRaw)).toThrow('Each module must have a string "prompt"');
    });

    test('validates module structure - invalid module type', () => {
      const inputRaw = {
        modules: [
          { id: 'intro', prompt: 'You are a helpful assistant.' },
          'invalid module' // Invalid module type
        ],
        prompts: [
          { id: 'p1', user: 'What is 2+2?' }
        ]
      };

      expect(() => parseInput(inputRaw)).toThrow('Each module must be an object');
    });

    test('validates prompts array exists', () => {
      const inputRaw = {
        system: 'You are a helpful assistant.'
        // Missing prompts array
      };

      expect(() => parseInput(inputRaw)).toThrow('Input must contain a "prompts" array');
    });

    test('validates prompts array is actually an array', () => {
      const inputRaw = {
        system: 'You are a helpful assistant.',
        prompts: 'not an array' // Invalid prompts type
      };

      expect(() => parseInput(inputRaw)).toThrow('Input must contain a "prompts" array');
    });

    test('throws error when neither system nor modules are provided', () => {
      const inputRaw = {
        prompts: [
          { id: 'p1', user: 'What is 2+2?' }
        ]
        // Missing both system and modules
      };

      expect(() => parseInput(inputRaw)).toThrow('Input must contain either "system" or "modules"');
    });

    test('handles empty modules array', () => {
      const inputRaw = {
        modules: [],
        prompts: [
          { id: 'p1', user: 'What is 2+2?' }
        ]
      };

      const result = parseInput(inputRaw);

      expect(result.system).toBe('');
      expect(result.prompts).toEqual([
        { id: 'p1', user: 'What is 2+2?' }
      ]);
    });

    test('handles single module', () => {
      const inputRaw = {
        modules: [
          { id: 'intro', prompt: 'You are a helpful assistant.' }
        ],
        prompts: [
          { id: 'p1', user: 'What is 2+2?' }
        ]
      };

      const result = parseInput(inputRaw);

      expect(result.system).toBe('You are a helpful assistant.');
      expect(result.prompts).toEqual([
        { id: 'p1', user: 'What is 2+2?' }
      ]);
    });

    test('handles multiple modules with proper concatenation', () => {
      const inputRaw = {
        modules: [
          { id: 'intro', prompt: 'You are a helpful assistant.' },
          { id: 'safety', prompt: 'Always be safe and accurate.' },
          { id: 'style', prompt: 'Be concise and clear.' }
        ],
        prompts: [
          { id: 'p1', user: 'What is 2+2?' }
        ]
      };

      const result = parseInput(inputRaw);

      expect(result.system).toBe('You are a helpful assistant.\n\nAlways be safe and accurate.\n\nBe concise and clear.');
      expect(result.prompts).toEqual([
        { id: 'p1', user: 'What is 2+2?' }
      ]);
    });
  });
});
