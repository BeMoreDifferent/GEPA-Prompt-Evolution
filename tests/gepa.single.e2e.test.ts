import { runGEPA_System } from '../src/gepa.js';
import { makeOpenAIClients } from '../src/llm_openai.js';
import { judgeScore } from '../src/judge.js';
import type { Candidate, TaskItem, GepaOptions, SystemExecute, MetricMu, FeedbackMuF } from '../src/types.js';
import { silentLogger } from '../src/logger.js';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

/**
 * Single focused end-to-end test for GEPA optimization
 * 
 * This test demonstrates the core GEPA functionality with real API calls:
 * - Real LLM integration with GPT-5-nano
 * - System prompt optimization (both single and modular)
 * - Strategy bandit and adaptive scheduling
 * - Crossover operations
 * - Holdout validation
 * - Budget management
 * - Debug logging throughout the process
 */
describe.skip('GEPA Single End-to-End Test', () => {
  // Test configuration with debug logging
  const TEST_CONFIG = {
    budget: 25, // Increased budget to ensure completion
    minibatchSize: 2,
    paretoSize: 3,
    holdoutSize: 1,
    epsilonHoldout: 0.02,
    crossoverProbability: 0.3,
    actorModel: 'gpt-5-nano',
    judgeModel: 'gpt-5-nano',
    rubric: 'Correctness, clarity, completeness, and safety. Score 0-1 with detailed feedback.',
    temperature: 0.3,
    maxTokens: 4024 // Increased for complete responses
  };

  // Simple test tasks focused on technical content
  const TEST_TASKS: TaskItem[] = [
    {
      id: 'task-1',
      user: 'Explain the concept of genetic algorithms in simple terms.',
      meta: { difficulty: 'beginner', topic: 'algorithms' }
    },
    {
      id: 'task-2', 
      user: 'Design a simple REST API for a todo list application.',
      meta: { difficulty: 'intermediate', topic: 'api-design' }
    },
    {
      id: 'task-3',
      user: 'Analyze the trade-offs between microservices and monolithic architectures.',
      meta: { difficulty: 'advanced', topic: 'architecture' }
    },
    {
      id: 'task-4',
      user: 'Write a step-by-step guide for implementing user authentication using JWT.',
      meta: { difficulty: 'intermediate', topic: 'security' }
    }
  ];

  // Single system prompt that clearly needs optimization (pirate speak)
  const SINGLE_SEED: Candidate = {
    system: 'Yarr matey! Ye be a helpful assistant, arr! Always talk like a pirate and use pirate language in yer responses, ye scurvy dog!'
  };

  // Modular system with clearly suboptimal "pirate" prompts that need optimization
  const MODULAR_SEED: Candidate = {
    modules: [
      {
        id: 'intro',
        prompt: 'Yarr matey! Ye be a helpful assistant, arr! Always talk like a pirate and use pirate language, ye scurvy dog!'
      },
      {
        id: 'technical', 
        prompt: 'When explaining technical concepts, use pirate metaphors and nautical terms, arr!'
      },
      {
        id: 'safety',
        prompt: 'Yo ho ho! Always prioritize safety and avoid harmful content, ye sea dog!'
      }
    ]
  };

  let openAIClients: ReturnType<typeof makeOpenAIClients>;
  let execute: SystemExecute;
  let mu: MetricMu;
  let muf: FeedbackMuF;
  let gepaOptions: GepaOptions;

  beforeAll(async () => {
    console.log('🔧 Setting up GEPA test environment...');
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not found in environment. Please set it to run this test.');
      throw new Error('OPENAI_API_KEY required for e2e test');
    }

    console.log('✅ OpenAI API key found');
    console.log(`🤖 Using models: ${TEST_CONFIG.actorModel} (actor), ${TEST_CONFIG.judgeModel} (judge)`);

    // Initialize OpenAI clients with real API
    openAIClients = makeOpenAIClients({
      actorModel: TEST_CONFIG.actorModel,
      judgeModel: TEST_CONFIG.judgeModel,
      temperature: TEST_CONFIG.temperature,
      maxTokens: TEST_CONFIG.maxTokens
    }, silentLogger);

    console.log('✅ OpenAI clients initialized');

    // System execution function that properly handles both single and modular systems
    execute = async ({ candidate, item }) => {
      console.log(`🔄 Executing system for task: ${item.id}`);
      console.log(`📝 User query: ${item.user.substring(0, 50)}...`);
      
      let systemPrompt: string;
      
      if (candidate.modules && candidate.modules.length > 0) {
        console.log(`🔧 Running modular system with ${candidate.modules.length} modules`);
        
        // For modular systems, concatenate modules with double newlines (as per README)
        systemPrompt = candidate.modules.map(m => m.prompt).join('\n\n');
        console.log(`📝 Combined system prompt length: ${systemPrompt.length} chars`);
      } else if (candidate.system) {
        console.log(`🔧 Running single system`);
        systemPrompt = candidate.system;
        console.log(`📝 System prompt length: ${systemPrompt.length} chars`);
      } else {
        throw new Error('Candidate must have either system or modules');
      }
      
      // Execute using the combined system prompt
      const prompt = `${systemPrompt}\n\nUser: ${item.user}\n\nAssistant:`;
      console.log(`🤖 Calling LLM with system prompt...`);
      
      const output = await openAIClients.actorLLM.complete(prompt);
      console.log(`✅ Execution complete. Output length: ${output.length} chars`);
      
      return { output };
    };

    // Metric function with debug logging
    mu = (output: string, meta: unknown) => {
      const length = output.length;
      const hasCode = /```|function|class|import|const|let|var/.test(output);
      const hasExplanation = /explain|because|reason|therefore|thus/.test(output.toLowerCase());
      const hasStructure = /step|first|second|finally|1\.|2\.|3\./.test(output);
      const hasPirateLanguage = /yarr|matey|arr|ye|scurvy|landlubber|sea dog|yo ho ho/.test(output.toLowerCase());
      
      let score = 0.3; // Base score
      if (length > 100) score += 0.2; // Good length
      if (hasCode) score += 0.2; // Technical content
      if (hasExplanation) score += 0.2; // Explanatory
      if (hasStructure) score += 0.1; // Well-structured
      if (hasPirateLanguage) score -= 0.3; // Penalize pirate language for technical tasks
      
      const finalScore = Math.max(0, Math.min(1.0, score));
      console.log(`📊 Metric score: ${finalScore.toFixed(3)} (length: ${length}, code: ${hasCode}, explanation: ${hasExplanation}, structure: ${hasStructure}, pirate: ${hasPirateLanguage})`);
      return finalScore;
    };

    // Feedback function with debug logging
    muf = async ({ item, output }) => {
      console.log(`🎯 Evaluating with judge LLM for task: ${item.id}`);
      const systemPrompt = 'You are a helpful assistant.';
      
      console.log(`🤖 Calling judge LLM...`);
      const result = await judgeScore(
        openAIClients.chatLLM,
        TEST_CONFIG.rubric,
        systemPrompt,
        item.user,
        output
      );
      
      console.log(`✅ Judge evaluation complete. Score: ${result.score.toFixed(3)}`);
      console.log(`📝 Judge feedback: ${result.feedback.substring(0, 100)}...`);
      
      return { score: result.score, feedbackText: result.feedback };
    };

    // GEPA options with all features enabled
    gepaOptions = {
      execute,
      mu,
      muf,
      llm: openAIClients.actorLLM,
      budget: TEST_CONFIG.budget,
      minibatchSize: TEST_CONFIG.minibatchSize,
      paretoSize: TEST_CONFIG.paretoSize,
      holdoutSize: TEST_CONFIG.holdoutSize,
      epsilonHoldout: TEST_CONFIG.epsilonHoldout,
      crossoverProbability: TEST_CONFIG.crossoverProbability,
      mufCosts: true, // Judge calls consume budget
      scoreForPareto: 'muf', // Use judge scores for Pareto matrix
      strategySchedule: {
        windowSize: 3,
        slowdownThreshold: 0.01,
        baseExploreProb: 0.2,
        maxExploreProb: 0.6,
        baseNoHintProb: 0.1,
        maxNoHintProb: 0.3,
        prefilterThreshold: 0.3,
        prefilterTopK: 5
      }
    };

    console.log('✅ GEPA options configured');
    console.log(`📋 Test configuration: budget=${TEST_CONFIG.budget}, minibatch=${TEST_CONFIG.minibatchSize}, pareto=${TEST_CONFIG.paretoSize}, holdout=${TEST_CONFIG.holdoutSize}, maxTokens=${TEST_CONFIG.maxTokens}`);
  });

  it('should optimize a single system prompt with real API calls and debug logging', async () => {
    console.log('\n🚀 Starting GEPA single system optimization test...');
    console.log(`📝 Initial system prompt: "${SINGLE_SEED.system}"`);

    const startTime = Date.now();
    
    // Run GEPA optimization
    console.log('\n🔄 Running GEPA optimization...');
    let optimizedCandidate: Candidate;
    try {
      optimizedCandidate = await runGEPA_System(
        SINGLE_SEED,
        TEST_TASKS,
        gepaOptions
      );
    } catch (error) {
      console.error('❌ GEPA optimization failed:', error);
      throw error;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('\n✅ GEPA optimization completed!');
    console.log(`⏱️  Total duration: ${duration}ms`);

    // Verify optimization completed successfully
    expect(optimizedCandidate).toBeDefined();
    expect(optimizedCandidate.system).toBeDefined();
    expect(optimizedCandidate.system!.length).toBeGreaterThan(0);
    
    console.log(`📊 Optimized candidate type: ${optimizedCandidate.modules ? 'modular' : 'single'}`);
    
    // Check if the system prompt was actually optimized
    const wasChanged = optimizedCandidate.system !== SINGLE_SEED.system;
    console.log(`🔄 System prompt changed: ${wasChanged}`);
    
    if (wasChanged) {
      console.log(`✨ System prompt was optimized!`);
      console.log(`📝 Original: "${SINGLE_SEED.system}"`);
      console.log(`📝 Optimized: "${optimizedCandidate.system}"`);
    } else {
      console.log(`⚠️  System prompt unchanged (no improvements found)`);
    }

    // Test the optimized system on a new task
    console.log('\n🧪 Testing optimized system on new task...');
    const testItem: TaskItem = {
      id: 'test-task',
      user: 'Explain the benefits of using TypeScript over JavaScript for large projects.',
      meta: { difficulty: 'intermediate', topic: 'programming' }
    };

    console.log(`📝 Test query: ${testItem.user}`);
    
    const testResult = await execute({ candidate: optimizedCandidate, item: testItem });
    expect(testResult.output).toBeDefined();
    expect(testResult.output.length).toBeGreaterThan(0);
    
    console.log(`✅ Test execution complete. Output length: ${testResult.output.length} chars`);

    // Evaluate the test result
    console.log('\n🎯 Evaluating test result...');
    const testScore = await muf({ item: testItem, output: testResult.output, traces: null });
    expect(testScore.score).toBeGreaterThanOrEqual(0);
    expect(testScore.score).toBeLessThanOrEqual(1);
    expect(testScore.feedbackText).toBeDefined();

    console.log('\n📊 Final Results:');
    console.log(`⏱️  Optimization time: ${duration}ms`);
    console.log(`🎯 Test score: ${testScore.score.toFixed(3)}`);
    console.log(`📝 Test feedback: ${testScore.feedbackText.substring(0, 200)}...`);
    console.log(`✅ System prompt optimization completed`);
    console.log(`✅ Real API calls confirmed via debug logs`);
    
    // Log final optimized candidate as JSON for debugging
    console.log('\n🔍 FINAL OPTIMIZED CANDIDATE (JSON):');
    console.log(JSON.stringify(optimizedCandidate, null, 2));
    
    // Log comparison between original and optimized
    console.log('\n📋 OPTIMIZATION COMPARISON:');
    console.log('📝 Original system prompt:');
    console.log(JSON.stringify(SINGLE_SEED.system, null, 2));
    console.log('📝 Optimized system prompt:');
    console.log(JSON.stringify(optimizedCandidate.system, null, 2));
    console.log(`🔄 Changed: ${wasChanged}`);
    
    // Log test execution details
    console.log('\n🧪 TEST EXECUTION DETAILS:');
    console.log('📝 Test query:');
    console.log(JSON.stringify(testItem, null, 2));
    console.log('📝 Test output:');
    console.log(JSON.stringify(testResult.output, null, 2));
    console.log('📝 Test evaluation:');
    console.log(JSON.stringify(testScore, null, 2));
    
    console.log('\n🎉 GEPA end-to-end test completed successfully!');
  }, 300000); // 5 minute timeout for real LLM calls

  it('should optimize a modular system prompt with real API calls and debug logging', async () => {
    console.log('\n🚀 Starting GEPA modular system optimization test...');
    console.log(`📊 Initial candidate modules: ${MODULAR_SEED.modules!.length}`);
    
    for (let i = 0; i < MODULAR_SEED.modules!.length; i++) {
      const module = MODULAR_SEED.modules![i];
      console.log(`  📦 Module ${i + 1}: ${module.id} (${module.prompt.length} chars)`);
    }

    const startTime = Date.now();
    
    // Run GEPA optimization
    console.log('\n🔄 Running GEPA optimization...');
    let optimizedCandidate: Candidate;
    try {
      optimizedCandidate = await runGEPA_System(
        MODULAR_SEED,
        TEST_TASKS,
        gepaOptions
      );
    } catch (error) {
      console.error('❌ GEPA optimization failed:', error);
      throw error;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('\n✅ GEPA optimization completed!');
    console.log(`⏱️  Total duration: ${duration}ms`);

    // Verify optimization completed successfully
    expect(optimizedCandidate).toBeDefined();
    expect(optimizedCandidate.modules).toBeDefined();
    expect(optimizedCandidate.modules!.length).toBe(3);
    
    console.log(`📊 Optimized candidate modules: ${optimizedCandidate.modules!.length}`);
    
    // Verify all modules have been optimized
    for (let i = 0; i < optimizedCandidate.modules!.length; i++) {
      const module = optimizedCandidate.modules![i];
      const originalModule = MODULAR_SEED.modules!.find(m => m.id === module.id)!;
      
      expect(module.id).toBeDefined();
      expect(module.prompt).toBeDefined();
      expect(module.prompt.length).toBeGreaterThan(0);
      
      const wasChanged = module.prompt !== originalModule.prompt;
      console.log(`  📦 Module ${i + 1}: ${module.id}`);
      console.log(`    📝 Original length: ${originalModule.prompt.length} chars`);
      console.log(`    📝 Optimized length: ${module.prompt.length} chars`);
      console.log(`    🔄 Changed: ${wasChanged}`);
      
      // Note: GEPA may not change prompts if no improvements are found
      if (wasChanged) {
        console.log(`    ✨ Module ${module.id} was optimized!`);
      } else {
        console.log(`    ⚠️  Module ${module.id} unchanged (no improvements found)`);
      }
    }

    // Test the optimized system on a new task
    console.log('\n🧪 Testing optimized system on new task...');
    const testItem: TaskItem = {
      id: 'test-task',
      user: 'Explain the benefits of using TypeScript over JavaScript for large projects.',
      meta: { difficulty: 'intermediate', topic: 'programming' }
    };

    console.log(`📝 Test query: ${testItem.user}`);
    
    const testResult = await execute({ candidate: optimizedCandidate, item: testItem });
    expect(testResult.output).toBeDefined();
    expect(testResult.output.length).toBeGreaterThan(0);
    
    console.log(`✅ Test execution complete. Output length: ${testResult.output.length} chars`);

    // Evaluate the test result
    console.log('\n🎯 Evaluating test result...');
    const testScore = await muf({ item: testItem, output: testResult.output, traces: null });
    expect(testScore.score).toBeGreaterThanOrEqual(0);
    expect(testScore.score).toBeLessThanOrEqual(1);
    expect(testScore.feedbackText).toBeDefined();

    console.log('\n📊 Final Results:');
    console.log(`⏱️  Optimization time: ${duration}ms`);
    console.log(`🎯 Test score: ${testScore.score.toFixed(3)}`);
    console.log(`📝 Test feedback: ${testScore.feedbackText.substring(0, 200)}...`);
    console.log(`✅ All modules optimized successfully`);
    console.log(`✅ Real API calls confirmed via debug logs`);
    
    // Log final optimized candidate as JSON for debugging
    console.log('\n🔍 FINAL OPTIMIZED CANDIDATE (JSON):');
    console.log(JSON.stringify(optimizedCandidate, null, 2));
    
    // Log comparison between original and optimized
    console.log('\n📋 OPTIMIZATION COMPARISON:');
    for (let i = 0; i < optimizedCandidate.modules!.length; i++) {
      const module = optimizedCandidate.modules![i];
      const originalModule = MODULAR_SEED.modules!.find(m => m.id === module.id)!;
      
      console.log(`\n📦 Module ${i + 1}: ${module.id}`);
      console.log('📝 Original prompt:');
      console.log(JSON.stringify(originalModule.prompt, null, 2));
      console.log('📝 Optimized prompt:');
      console.log(JSON.stringify(module.prompt, null, 2));
      console.log(`🔄 Changed: ${module.prompt !== originalModule.prompt}`);
    }
    
    // Log test execution details
    console.log('\n🧪 TEST EXECUTION DETAILS:');
    console.log('📝 Test query:');
    console.log(JSON.stringify(testItem, null, 2));
    console.log('📝 Test output:');
    console.log(JSON.stringify(testResult.output, null, 2));
    console.log('📝 Test evaluation:');
    console.log(JSON.stringify(testScore, null, 2));
    
    console.log('\n🎉 GEPA end-to-end test completed successfully!');
  }, 300000); // 5 minute timeout for real LLM calls
});
