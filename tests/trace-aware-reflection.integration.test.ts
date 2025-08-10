import { runGEPA_System } from '../src/gepa.js';
import type { Candidate, TaskItem, GepaOptions } from '../src/types.js';

describe('Trace-aware reflection integration', () => {
  test('includes execution traces in reflection prompts', async () => {
    const seed: Candidate = { system: 'You are a helpful assistant.' };
    const dtrain: TaskItem[] = [
      { id: '1', user: 'What is 2+2?' },
      { id: '2', user: 'What is 3+3?' },
      { id: '3', user: 'What is 4+4?' },
      { id: '4', user: 'What is 5+5?' },
      { id: '5', user: 'What is 6+6?' }
    ];

    // Mock execute function that returns traces
    const execute = async ({ candidate, item }: { candidate: Candidate; item: TaskItem }) => ({
      output: `Answer: ${item.user}`,
      traces: {
        system: candidate.system,
        timestamp: new Date().toISOString(),
        steps: ['parsed_input', 'generated_response'],
        metadata: { itemId: item.id }
      }
    });

    // Mock feedback function that gives poor initial scores to trigger reflection
    const muf = async ({ item, output }: { item: TaskItem; output: string }) => ({
      score: 0.1, // Poor score to trigger reflection
      feedbackText: 'Poor response - needs improvement'
    });

    // Mock LLM that captures prompts to verify trace inclusion
    let capturedPrompts: string[] = [];
    const llm = {
      complete: async (prompt: string) => {
        capturedPrompts.push(prompt);
        // Return a better system prompt to ensure acceptance
        return "'''\nYou are an improved helpful assistant that always provides accurate answers.\n'''";
      }
    };

    const opts: GepaOptions = {
      execute,
      mu: (y: string) => 0.1, // Poor score to trigger reflection
      muf,
      llm,
      budget: 10,
      minibatchSize: 2,
      paretoSize: 2
    };

    await runGEPA_System(seed, dtrain, opts);

    // Verify that at least one reflection prompt was generated
    expect(capturedPrompts.length).toBeGreaterThan(0);

    // Verify that traces are included in reflection prompts
    const promptsWithTraces = capturedPrompts.filter(prompt => 
      prompt.includes('TRACES:') || 
      prompt.includes('EXECUTION TRACE:') ||
      prompt.includes('EVALUATOR TRACE:')
    );

    expect(promptsWithTraces.length).toBeGreaterThan(0);

    // Verify trace content structure
    const tracePrompts = promptsWithTraces.filter(prompt => 
      prompt.includes('"system"') && 
      prompt.includes('"timestamp"') && 
      prompt.includes('"steps"')
    );

    expect(tracePrompts.length).toBeGreaterThan(0);
  });

  test('handles traces with size limits', async () => {
    const seed: Candidate = { system: 'You are a helpful assistant.' };
    const dtrain: TaskItem[] = [
      { id: '1', user: 'What is 2+2?' }
    ];

    // Mock execute function that returns large traces
    const execute = async ({ candidate, item }: { candidate: Candidate; item: TaskItem }) => ({
      output: `Answer: ${item.user}`,
      traces: {
        system: candidate.system,
        largeData: 'x'.repeat(5000), // Very large trace
        metadata: { itemId: item.id }
      }
    });

    const muf = async ({ item, output }: { item: TaskItem; output: string }) => ({
      score: 0.8,
      feedbackText: 'Good response'
    });

    let capturedPrompts: string[] = [];
    const llm = {
      complete: async (prompt: string) => {
        capturedPrompts.push(prompt);
        return "'''\nYou are an improved helpful assistant.\n'''";
      }
    };

    const opts: GepaOptions = {
      execute,
      mu: (y: string) => 0.8,
      muf,
      llm,
      budget: 15,
      minibatchSize: 1,
      paretoSize: 1
    };

    await runGEPA_System(seed, dtrain, opts);

    // Verify that prompts are generated
    expect(capturedPrompts.length).toBeGreaterThan(0);

    // Verify that large traces are truncated
    const promptsWithTraces = capturedPrompts.filter(prompt => 
      prompt.includes('TRACES:') || 
      prompt.includes('EXECUTION TRACE:')
    );

    expect(promptsWithTraces.length).toBeGreaterThan(0);

    // Verify that traces are truncated (should not contain the full 5000 character string)
    const hasTruncatedTraces = promptsWithTraces.some(prompt => {
      const traceSection = prompt.split('TRACES:')[1]?.split('Write a NEW')[0] || '';
      return traceSection.includes('...') && traceSection.length < 5000;
    });

    expect(hasTruncatedTraces).toBe(true);
  });

  test('works with modular systems', async () => {
    const seed: Candidate = { 
      modules: [
        { id: 'module1', prompt: 'You are a helpful assistant.' },
        { id: 'module2', prompt: 'You are a math expert.' }
      ]
    };
    const dtrain: TaskItem[] = [
      { id: '1', user: 'What is 2+2?' }
    ];

    const execute = async ({ candidate, item }: { candidate: Candidate; item: TaskItem }) => ({
      output: `Answer: ${item.user}`,
      traces: {
        modules: candidate.modules?.map(m => m.id),
        timestamp: new Date().toISOString(),
        metadata: { itemId: item.id }
      }
    });

    const muf = async ({ item, output }: { item: TaskItem; output: string }) => ({
      score: 0.8,
      feedbackText: 'Good response'
    });

    let capturedPrompts: string[] = [];
    const llm = {
      complete: async (prompt: string) => {
        capturedPrompts.push(prompt);
        return "'''\nYou are an improved helpful assistant.\n'''";
      }
    };

    const opts: GepaOptions = {
      execute,
      mu: (y: string) => 0.8,
      muf,
      llm,
      budget: 15,
      minibatchSize: 1,
      paretoSize: 1
    };

    await runGEPA_System(seed, dtrain, opts);

    // Verify that module reflection prompts are generated
    expect(capturedPrompts.length).toBeGreaterThan(0);

    // Verify that module context is preserved with traces
    const modulePrompts = capturedPrompts.filter(prompt => 
      prompt.includes('Module 1') && 
      prompt.includes('CURRENT MODULE TO UPDATE')
    );

    expect(modulePrompts.length).toBeGreaterThan(0);

    // Verify that traces are included in module prompts
    const modulePromptsWithTraces = modulePrompts.filter(prompt => 
      prompt.includes('TRACES:') || 
      prompt.includes('EXECUTION TRACE:')
    );

    expect(modulePromptsWithTraces.length).toBeGreaterThan(0);
  });
});
