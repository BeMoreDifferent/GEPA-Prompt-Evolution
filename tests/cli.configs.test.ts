import { validateConfig, applyDefaults, parseInput } from '../src/cli.js';

describe('CLI Configuration', () => {
  describe('validateConfig', () => {
    it('should pass with valid configuration', () => {
      const config = {
        budget: 50,
        paretoSize: 2,
        holdoutSize: 0,
        minibatchSize: 2,
        actorModel: 'gpt-5-mini',
        judgeModel: 'gpt-5-mini'
      };
      expect(() => validateConfig(config, 4)).not.toThrow();
    });

    it('should reject budget too small', () => {
      const config = { budget: 5 };
      expect(() => validateConfig(config, 4)).toThrow('Budget must be at least 10');
    });

    it('should reject impossible data split', () => {
      const config = { paretoSize: 3, holdoutSize: 2 };
      expect(() => validateConfig(config, 4)).toThrow('Data split impossible');
    });

    it('should reject minibatch too large', () => {
      const config = { paretoSize: 2, holdoutSize: 1, minibatchSize: 2 };
      expect(() => validateConfig(config, 4)).toThrow('Minibatch size (2) too large');
    });

    it('should reject zero pareto size', () => {
      const config = { paretoSize: 0 };
      expect(() => validateConfig(config, 4)).toThrow('Pareto size must be at least 1');
    });

    it('should reject missing models', () => {
      const config = { actorModel: '', judgeModel: '' };
      expect(() => validateConfig(config, 4)).toThrow('Both actorModel and judgeModel must be specified');
    });
  });

  describe('applyDefaults', () => {
    it('should apply sensible defaults for small dataset', () => {
      const config = {};
      const result = applyDefaults(config, 4);
      
      expect(result.budget).toBeGreaterThanOrEqual(50);
      expect(result.minibatchSize).toBeLessThanOrEqual(4);
      expect(result.paretoSize).toBeGreaterThanOrEqual(2);
      expect(result.holdoutSize).toBeGreaterThanOrEqual(0);
      expect(result.actorModel).toBe('gpt-5-mini');
      expect(result.judgeModel).toBe('gpt-5-mini');
    });

    it('should respect provided values', () => {
      const config = { budget: 100, actorModel: 'gpt-4' };
      const result = applyDefaults(config, 4);
      
      expect(result.budget).toBe(100);
      expect(result.actorModel).toBe('gpt-4');
      expect(result.judgeModel).toBe('gpt-5-mini'); // default
    });

    it('should scale budget with dataset size', () => {
      const config = {};
      const result10 = applyDefaults(config, 10);
      const result20 = applyDefaults(config, 20);
      
      expect(Number(result20.budget)).toBeGreaterThan(Number(result10.budget));
    });
  });

  describe('parseInput', () => {
    it('should parse system prompt format', () => {
      const input = {
        system: 'You are a helpful assistant',
        prompts: [{ id: '1', user: 'Hello' }]
      };
      const result = parseInput(input);
      expect(result.system).toBe('You are a helpful assistant');
      expect(result.prompts).toHaveLength(1);
    });

    it('should parse modules format', () => {
      const input = {
        modules: [
          { id: 'intro', prompt: 'Introduction' },
          { id: 'main', prompt: 'Main content' }
        ],
        prompts: [{ id: '1', user: 'Hello' }]
      };
      const result = parseInput(input);
      expect(result.system).toBe('Introduction\n\nMain content');
      expect(result.prompts).toHaveLength(1);
    });

    it('should reject missing prompts', () => {
      const input = { system: 'test' };
      expect(() => parseInput(input)).toThrow('Input must contain a "prompts" array');
    });

    it('should reject missing system and modules', () => {
      const input = { prompts: [] };
      expect(() => parseInput(input)).toThrow('Input must contain either "system" or "modules"');
    });

    it('should validate module structure', () => {
      const input = {
        modules: [{ id: 'test' }], // missing prompt
        prompts: []
      };
      expect(() => parseInput(input)).toThrow('Each module must have a string "prompt"');
    });
  });
});
