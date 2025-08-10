import { buildReflectionPrompt, buildModuleReflectionPrompt, summarizeTraces, type JudgedExample } from '../src/reflection.js';

describe('summarizeTraces', () => {
  test('returns undefined for null/undefined traces', () => {
    expect(summarizeTraces(null)).toBeUndefined();
    expect(summarizeTraces(undefined)).toBeUndefined();
  });

  test('returns undefined for non-object traces', () => {
    expect(summarizeTraces('string')).toBeUndefined();
    expect(summarizeTraces(123)).toBeUndefined();
  });

  test('creates deterministic JSON with sorted keys', () => {
    const traces = { b: 2, a: 1, c: 3 };
    const result = summarizeTraces(traces);
    expect(result).toBe('{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}');
  });

  test('truncates long traces while preserving structure', () => {
    const traces = { 
      longKey: 'x'.repeat(2000),
      shortKey: 'short'
    };
    const result = summarizeTraces(traces, 100);
    expect(result).toContain('...');
    expect(result!.length).toBeLessThanOrEqual(103); // 100 + 3 for '...'
  });

  test('handles complex nested objects', () => {
    const traces = {
      nested: { key: 'value' },
      array: [1, 2, 3],
      string: 'test'
    };
    const result = summarizeTraces(traces);
    expect(result).toContain('"nested"');
    expect(result).toContain('"array"');
    expect(result).toContain('"string"');
  });

  test('falls back to string representation on JSON error', () => {
    const circular: any = {};
    circular.self = circular;
    
    const result = summarizeTraces(circular, 50);
    expect(result).toContain('[object Object]');
    expect(result!.length).toBeLessThanOrEqual(53);
  });
});

describe('buildReflectionPrompt with traces', () => {
  test('includes execution traces when present', () => {
    const examples: JudgedExample[] = [{
      user: 'test user',
      output: 'test output',
      feedback: 'test feedback',
      execTrace: '{"step": "execution"}'
    }];
    
    const prompt = buildReflectionPrompt('system prompt', examples);
    expect(prompt).toContain('EXECUTION TRACE: {"step": "execution"}');
    expect(prompt).toContain('TRACES:');
  });

  test('includes evaluator traces when present', () => {
    const examples: JudgedExample[] = [{
      user: 'test user',
      output: 'test output',
      feedback: 'test feedback',
      evalTrace: '{"step": "evaluation"}'
    }];
    
    const prompt = buildReflectionPrompt('system prompt', examples);
    expect(prompt).toContain('EVALUATOR TRACE: {"step": "evaluation"}');
    expect(prompt).toContain('TRACES:');
  });

  test('includes both traces when present', () => {
    const examples: JudgedExample[] = [{
      user: 'test user',
      output: 'test output',
      feedback: 'test feedback',
      execTrace: '{"step": "execution"}',
      evalTrace: '{"step": "evaluation"}'
    }];
    
    const prompt = buildReflectionPrompt('system prompt', examples);
    expect(prompt).toContain('EXECUTION TRACE: {"step": "execution"}');
    expect(prompt).toContain('EVALUATOR TRACE: {"step": "evaluation"}');
    expect(prompt).toContain('TRACES:');
  });

  test('omits traces section when no traces present', () => {
    const examples: JudgedExample[] = [{
      user: 'test user',
      output: 'test output',
      feedback: 'test feedback'
    }];
    
    const prompt = buildReflectionPrompt('system prompt', examples);
    expect(prompt).not.toContain('TRACES:');
    expect(prompt).not.toContain('EXECUTION TRACE:');
    expect(prompt).not.toContain('EVALUATOR TRACE:');
  });

  test('handles mixed examples with and without traces', () => {
    const examples: JudgedExample[] = [
      {
        user: 'user1',
        output: 'output1',
        feedback: 'feedback1',
        execTrace: '{"step": "exec1"}'
      },
      {
        user: 'user2',
        output: 'output2',
        feedback: 'feedback2'
      }
    ];
    
    const prompt = buildReflectionPrompt('system prompt', examples);
    expect(prompt).toContain('EXECUTION TRACE: {"step": "exec1"}');
    expect(prompt).toContain('TRACES:');
    // Second example should not have traces section
    expect(prompt).toContain('#2 USER:');
    expect(prompt).toContain('ASSISTANT:');
    expect(prompt).toContain('FEEDBACK:');
  });
});

describe('buildModuleReflectionPrompt with traces', () => {
  const module = { id: 'test-module', prompt: 'test prompt' };
  const allModules = [module];

  test('includes execution traces in module reflection', () => {
    const examples: JudgedExample[] = [{
      user: 'test user',
      output: 'test output',
      feedback: 'test feedback',
      execTrace: '{"step": "execution"}'
    }];
    
    const prompt = buildModuleReflectionPrompt(module, allModules, 0, examples);
    expect(prompt).toContain('EXECUTION TRACE: {"step": "execution"}');
    expect(prompt).toContain('TRACES:');
  });

  test('includes evaluator traces in module reflection', () => {
    const examples: JudgedExample[] = [{
      user: 'test user',
      output: 'test output',
      feedback: 'test feedback',
      evalTrace: '{"step": "evaluation"}'
    }];
    
    const prompt = buildModuleReflectionPrompt(module, allModules, 0, examples);
    expect(prompt).toContain('EVALUATOR TRACE: {"step": "evaluation"}');
    expect(prompt).toContain('TRACES:');
  });

  test('maintains module context when traces are present', () => {
    const examples: JudgedExample[] = [{
      user: 'test user',
      output: 'test output',
      feedback: 'test feedback',
      execTrace: '{"step": "execution"}'
    }];
    
    const prompt = buildModuleReflectionPrompt(module, allModules, 0, examples);
    expect(prompt).toContain('>>> Module 1 (test-module): CURRENT MODULE TO UPDATE');
    expect(prompt).toContain('Current module 1 (test-module):');
    expect(prompt).toContain('EXECUTION TRACE: {"step": "execution"}');
  });
});

describe('trace size limits', () => {
  test('enforces trace size limits in prompts', () => {
    const longTraceData = { data: 'x'.repeat(2000) };
    const summarizedTrace = summarizeTraces(longTraceData, 100);
    const examples: JudgedExample[] = [{
      user: 'test user',
      output: 'test output',
      feedback: 'test feedback',
      execTrace: summarizedTrace
    }];
    
    const prompt = buildReflectionPrompt('system prompt', examples);
    const traceSection = prompt.split('TRACES:')[1]?.split('Write a NEW')[0] || '';
    
    // Should be significantly shorter than the original trace
    expect(traceSection.length).toBeLessThan(JSON.stringify(longTraceData).length);
    expect(traceSection).toContain('...');
  });

  test('maintains prompt readability with large traces', () => {
    const examples: JudgedExample[] = [{
      user: 'test user',
      output: 'test output',
      feedback: 'test feedback',
      execTrace: '{"very": "long", "trace": "data".repeat(1000)}'
    }];
    
    const prompt = buildReflectionPrompt('system prompt', examples);
    
    // Prompt should still contain all essential sections
    expect(prompt).toContain('You will REWRITE');
    expect(prompt).toContain('Current system prompt:');
    expect(prompt).toContain('Write a NEW system prompt');
    expect(prompt).toContain('Return only the new system prompt');
  });
});
