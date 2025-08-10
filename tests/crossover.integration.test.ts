import { runGEPA_System } from '../src/gepa.js';
import type { Candidate, TaskItem, GepaOptions } from '../src/types.js';

// Mock implementations for testing
const mockExecute = async ({ candidate }: { candidate: Candidate; item: TaskItem }) => {
  const systemPrompt = candidate.system || candidate.modules?.map(m => m.prompt).join('\n\n') || '';
  return {
    output: `Response to: ${systemPrompt.slice(0, 50)}...`,
    traces: null
  };
};

const mockMu = (output: string, meta: unknown) => {
  // Simple scoring based on output length and content
  const score = Math.min(1.0, Math.max(0.0, output.length / 100));
  return score;
};

const mockMuf = async ({ output }: { item: TaskItem; output: string; traces?: Record<string, unknown> | null }) => {
  const score = mockMu(output, null);
  return {
    score,
    feedbackText: `Feedback for output: ${output.slice(0, 50)}...`
  };
};

const mockLLM = {
  complete: async (prompt: string) => {
    // Simple mock that returns a modified version of the input
    if (prompt.includes('personality')) {
      return 'You are very friendly and approachable.';
    } else if (prompt.includes('instructions')) {
      return 'Always provide detailed and accurate responses.';
    } else if (prompt.includes('safety')) {
      return 'Never provide harmful or inappropriate content.';
    }
    return 'You are a helpful assistant.';
  }
};

describe('crossover.integration.test.ts - GEPA crossover integration', () => {
  const modularSeed: Candidate = {
    modules: [
      { id: 'personality', prompt: 'You are friendly.' },
      { id: 'instructions', prompt: 'Always be helpful.' },
      { id: 'safety', prompt: 'Never be harmful.' }
    ]
  };

  const taskItems: TaskItem[] = [
    { id: 'task1', user: 'What is the weather like?' },
    { id: 'task2', user: 'How do I cook pasta?' },
    { id: 'task3', user: 'Explain quantum physics.' },
    { id: 'task4', user: 'Write a poem about nature.' },
    { id: 'task5', user: 'What are the benefits of exercise?' },
    { id: 'task6', user: 'How to learn a new language?' },
    { id: 'task7', user: 'What is machine learning?' },
    { id: 'task8', user: 'Tell me a joke.' }
  ];

  const baseOptions: GepaOptions = {
    execute: mockExecute,
    mu: mockMu,
    muf: mockMuf,
    llm: mockLLM,
    budget: 20,
    minibatchSize: 2,
    paretoSize: 3
  };

  test('GEPA with crossover probability 0 (mutation only)', async () => {
    const options = { ...baseOptions, crossoverProbability: 0 };
    
    const result = await runGEPA_System(modularSeed, taskItems, options);
    
    expect(result).toBeDefined();
    expect(result.modules).toBeDefined();
    expect(result.modules!.length).toBe(3);
    
    // Should have the same module structure
    expect(result.modules![0].id).toBe('personality');
    expect(result.modules![1].id).toBe('instructions');
    expect(result.modules![2].id).toBe('safety');
  });

  test('GEPA with crossover probability 0.5 (mixed mutation and crossover)', async () => {
    const options = { ...baseOptions, crossoverProbability: 0.5 };
    
    const result = await runGEPA_System(modularSeed, taskItems, options);
    
    expect(result).toBeDefined();
    expect(result.modules).toBeDefined();
    expect(result.modules!.length).toBe(3);
    
    // Should have the same module structure
    expect(result.modules![0].id).toBe('personality');
    expect(result.modules![1].id).toBe('instructions');
    expect(result.modules![2].id).toBe('safety');
  });

  test('GEPA with crossover probability 1.0 (crossover only when possible)', async () => {
    const options = { ...baseOptions, crossoverProbability: 1.0 };
    
    const result = await runGEPA_System(modularSeed, taskItems, options);
    
    expect(result).toBeDefined();
    expect(result.modules).toBeDefined();
    expect(result.modules!.length).toBe(3);
    
    // Should have the same module structure
    expect(result.modules![0].id).toBe('personality');
    expect(result.modules![1].id).toBe('instructions');
    expect(result.modules![2].id).toBe('safety');
  });

  test('GEPA with single-system candidate (backward compatibility)', async () => {
    const singleSystemSeed: Candidate = {
      system: 'You are a helpful assistant.'
    };
    
    const options = { ...baseOptions, crossoverProbability: 0.5 };
    
    const result = await runGEPA_System(singleSystemSeed, taskItems, options);
    
    expect(result).toBeDefined();
    // Should maintain backward compatibility
    expect(result.system || result.modules).toBeDefined();
  });

  test('GEPA state includes lineage tracking', async () => {
    const options = { ...baseOptions, crossoverProbability: 0.3 };
    
    let capturedState: any = null;
    const persist = {
      onCheckpoint: async (state: any) => {
        capturedState = state;
      }
    };
    
    await runGEPA_System(modularSeed, taskItems, options, persist);
    
    // Verify that lineage tracking is present
    expect(capturedState).toBeDefined();
    expect(capturedState.lineage).toBeDefined();
    expect(Array.isArray(capturedState.lineage)).toBe(true);
    
    // Check lineage structure if any entries exist
    if (capturedState.lineage.length > 0) {
      const lineageEntry = capturedState.lineage[0];
      expect(lineageEntry).toHaveProperty('candidateIndex');
      expect(lineageEntry).toHaveProperty('changedModules');
      expect(lineageEntry).toHaveProperty('parentIndex');
      expect(Array.isArray(lineageEntry.changedModules)).toBe(true);
    }
    
    // Verify that lineage array is initialized even if no candidates were accepted
    expect(capturedState.lineage).toEqual([]);
  });
});
