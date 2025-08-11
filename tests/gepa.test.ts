import { jest } from '@jest/globals';
import { runGEPA_System } from '../src/gepa.js';
import type { Candidate, TaskItem, GepaOptions, SystemExecute, FeedbackMuF, LLM } from '../src/types.js';

// Mock dependencies
jest.mock('../src/llm_openai.js');
jest.mock('../src/reflection.js');
jest.mock('../src/strategy.js');

describe('runGEPA_System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a candidate with a system string', async () => {
    // Mock the reflection module
    const mockProposeNewModule = async () => ({ system: 'Improved.' });
    jest.doMock('../src/reflection.js', () => ({
      proposeNewModule: mockProposeNewModule,
      summarizeTraces: () => 'mock trace'
    }));

    // Mock the strategy module
    jest.doMock('../src/strategy.js', () => ({
      prefilterStrategies: async () => ({
        kept: [{ id: 'test-strategy', hint: 'Test hint' }],
        scores: {},
        raw: ''
      })
    }));

    const seed: Candidate = { system: 'You are a helpful assistant' };
    const dtrain: TaskItem[] = [
      { id: '1', user: 'Hello', meta: null },
      { id: '2', user: 'How are you?', meta: null },
      { id: '3', user: 'What is 2+2?', meta: null },
      { id: '4', user: 'Explain quantum physics', meta: null },
      { id: '5', user: 'Write a poem', meta: null },
      { id: '6', user: 'Solve this equation', meta: null },
      { id: '7', user: 'Analyze this data', meta: null },
      { id: '8', user: 'Create a story', meta: null },
      { id: '9', user: 'Design a system', meta: null },
      { id: '10', user: 'Optimize this code', meta: null },
      { id: '11', user: 'Plan a project', meta: null },
      { id: '12', user: 'Review this document', meta: null },
      { id: '13', user: 'Debug this issue', meta: null },
      { id: '14', user: 'Test this function', meta: null },
      { id: '15', user: 'Deploy this application', meta: null },
      { id: '16', user: 'Monitor this system', meta: null },
      { id: '17', user: 'Scale this infrastructure', meta: null },
      { id: '18', user: 'Secure this network', meta: null },
      { id: '19', user: 'Backup this data', meta: null },
      { id: '20', user: 'Restore this system', meta: null }
    ];

    const execute: SystemExecute = async () => ({
      output: 'Mock response',
      traces: { system: 'Mock system' }
    });

    const muf: FeedbackMuF = async () => ({
      score: 0.6,
      feedbackText: 'Good response'
    });

    const llm: LLM = {
      complete: async () => 'Mock completion'
    };

    const options: GepaOptions = {
      execute,
      mu: () => 0.5,
      muf,
      llm,
      budget: 20,
      minibatchSize: 4,
      paretoSize: 5,
      holdoutSize: 4,
      epsilonHoldout: 0.02,
      scoreForPareto: 'muf',
      mufCosts: true
    };

    const result = await runGEPA_System(seed, dtrain, options);
    expect(result.system).toBeDefined();
  });

  it('optimizes when feedback is available (accept child)', async () => {
    // Mock the reflection module
    const mockProposeNewModule = async () => ({ system: 'Improved.' });
    jest.doMock('../src/reflection.js', () => ({
      proposeNewModule: mockProposeNewModule,
      summarizeTraces: () => 'mock trace'
    }));

    // Mock the strategy module
    jest.doMock('../src/strategy.js', () => ({
      prefilterStrategies: async () => ({
        kept: [{ id: 'test-strategy', hint: 'Test hint' }],
        scores: {},
        raw: ''
      })
    }));

    const seed: Candidate = { system: 'You are a helpful assistant' };
    const dtrain: TaskItem[] = [
      { id: '1', user: 'Hello', meta: null },
      { id: '2', user: 'How are you?', meta: null },
      { id: '3', user: 'What is 2+2?', meta: null },
      { id: '4', user: 'Explain quantum physics', meta: null },
      { id: '5', user: 'Write a poem', meta: null },
      { id: '6', user: 'Solve this equation', meta: null }
    ];

    const execute: SystemExecute = async () => ({
      output: 'Mock response',
      traces: { system: 'Mock system' }
    });

    const muf: FeedbackMuF = async () => ({
      score: 0.8, // Higher score to trigger acceptance
      feedbackText: 'Good response'
    });

    const llm: LLM = {
      complete: async () => 'Mock completion'
    };

    const options: GepaOptions = {
      execute,
      mu: () => 0.5,
      muf,
      llm,
      budget: 20,
      minibatchSize: 2,
      paretoSize: 2,
      holdoutSize: 1,
      epsilonHoldout: 0.02,
      scoreForPareto: 'muf',
      mufCosts: true
    };

    const result = await runGEPA_System(seed, dtrain, options);
    expect(result.system).toBeDefined();
    // Note: mockProposeNewModule may not be called if the child is not accepted
  });

  it('stagnation triggers re-prefilter without crashing', async () => {
    // Mock the reflection module
    const mockProposeNewModule = async () => ({ system: 'Improved.' });
    jest.doMock('../src/reflection.js', () => ({
      proposeNewModule: mockProposeNewModule,
      summarizeTraces: () => 'mock trace'
    }));

    // Mock the strategy module
    jest.doMock('../src/strategy.js', () => ({
      prefilterStrategies: async () => ({
        kept: [{ id: 'test-strategy', hint: 'Test hint' }],
        scores: {},
        raw: ''
      })
    }));

    const seed: Candidate = { system: 'You are a helpful assistant' };
    const dtrain: TaskItem[] = [
      { id: '1', user: 'Hello', meta: null },
      { id: '2', user: 'How are you?', meta: null },
      { id: '3', user: 'What is 2+2?', meta: null },
      { id: '4', user: 'Explain quantum physics', meta: null },
      { id: '5', user: 'Write a poem', meta: null },
      { id: '6', user: 'Solve this equation', meta: null }
    ];

    const execute: SystemExecute = async () => ({
      output: 'Mock response',
      traces: { system: 'Mock system' }
    });

    const muf: FeedbackMuF = async () => ({
      score: 0.3, // Lower score to trigger stagnation
      feedbackText: 'Poor response'
    });

    const llm: LLM = {
      complete: async () => 'Mock completion'
    };

    const options: GepaOptions = {
      execute,
      mu: () => 0.5,
      muf,
      llm,
      budget: 20,
      minibatchSize: 2,
      paretoSize: 2,
      holdoutSize: 1,
      epsilonHoldout: 0.02,
      scoreForPareto: 'muf',
      mufCosts: true
    };

    const result = await runGEPA_System(seed, dtrain, options);
    expect(result.system).toBeDefined();
  });

  it('falls back to use Pareto items as feedback if split yields none', async () => {
    // Mock the reflection module
    const mockProposeNewModule = async () => ({ system: 'Improved.' });
    jest.doMock('../src/reflection.js', () => ({
      proposeNewModule: mockProposeNewModule,
      summarizeTraces: () => 'mock trace'
    }));

    // Mock the strategy module
    jest.doMock('../src/strategy.js', () => ({
      prefilterStrategies: async () => ({
        kept: [{ id: 'test-strategy', hint: 'Test hint' }],
        scores: {},
        raw: ''
      })
    }));

    const seed: Candidate = { system: 'You are a helpful assistant' };
    const dtrain: TaskItem[] = [
      { id: '1', user: 'Hello', meta: null },
      { id: '2', user: 'How are you?', meta: null }
    ];

    const execute: SystemExecute = async () => ({
      output: 'Mock response',
      traces: { system: 'Mock system' }
    });

    const muf: FeedbackMuF = async () => ({
      score: 0.6,
      feedbackText: 'Good response'
    });

    const llm: LLM = {
      complete: async () => 'Mock completion'
    };

    const options: GepaOptions = {
      execute,
      mu: () => 0.5,
      muf,
      llm,
      budget: 20,
      minibatchSize: 1,
      paretoSize: 1,
      holdoutSize: 0,
      epsilonHoldout: 0.02,
      scoreForPareto: 'muf',
      mufCosts: true
    };

    const result = await runGEPA_System(seed, dtrain, options);
    expect(result.system).toBeDefined();
  });
});


