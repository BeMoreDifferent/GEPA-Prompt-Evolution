#!/usr/bin/env node
import path from 'node:path';
import * as fs from 'node:fs/promises';
import { runGEPA_System, DEFAULT_STRATEGIES_PATH } from './gepa.js';
import { makeOpenAIClients } from './llm_openai.js';
import { judgeScore } from './judge.js';
import { initRun, resumeRun, acquireLock, saveIteration, saveState, writeJsonAtomic } from './persist.js';
import type { Candidate, GepaOptions, MetricMu, FeedbackMuF, TaskItem } from './types.js';
import { createLogger, type LogLevel } from './logger.js';
import { concatenateModules } from './modules.js';

/**
 * Calculate percentage improvement
 */
function calculateImprovement(initial: number, final: number): { absolute: number; percentage: number } {
  const absolute = final - initial;
  const percentage = initial > 0 ? (absolute / initial) * 100 : 0;
  return { absolute, percentage };
}

/**
 * Format statistics for logging
 */
function formatStats(stats: {
  initialScore: number;
  finalScore: number;
  iterations: number;
  budgetUsed: number;
  totalBudget: number;
  candidatesGenerated: number;
  acceptedCandidates: number;
  crossoverOperations: number;
  mutationOperations: number;
  strategySwitches: number;
  paretoSize: number;
  feedbackSize: number;
  holdoutSize: number;
}): string {
  const improvement = calculateImprovement(stats.initialScore, stats.finalScore);
  const budgetEfficiency = ((stats.budgetUsed / stats.totalBudget) * 100).toFixed(1);
  const acceptanceRate = ((stats.acceptedCandidates / stats.candidatesGenerated) * 100).toFixed(1);
  const crossoverRate = ((stats.crossoverOperations / stats.candidatesGenerated) * 100).toFixed(1);
  
  return [
    `📊 PERFORMANCE STATISTICS`,
    `├─ Initial Score: ${stats.initialScore.toFixed(3)}`,
    `├─ Final Score: ${stats.finalScore.toFixed(3)}`,
    `├─ Absolute Improvement: ${improvement.absolute.toFixed(3)}`,
    `├─ Percentage Improvement: ${improvement.percentage.toFixed(1)}%`,
    `├─ Iterations Completed: ${stats.iterations}`,
    `├─ Candidates Generated: ${stats.candidatesGenerated}`,
    `├─ Candidates Accepted: ${stats.acceptedCandidates} (${acceptanceRate}%)`,
    `├─ Crossover Operations: ${stats.crossoverOperations} (${crossoverRate}%)`,
    `├─ Mutation Operations: ${stats.mutationOperations}`,
    `├─ Strategy Switches: ${stats.strategySwitches}`,
    `├─ Budget Used: ${stats.budgetUsed}/${stats.totalBudget} (${budgetEfficiency}%)`,
    `├─ Data Split: Pareto=${stats.paretoSize}, Feedback=${stats.feedbackSize}, Holdout=${stats.holdoutSize}`,
    `└─ Efficiency: ${(stats.finalScore / stats.budgetUsed).toFixed(4)} score per budget unit`
  ].join('\n');
}

/**
 * Validate configuration and provide helpful error messages
 */
function validateConfig(config: Record<string, unknown>, dtrainLength: number): void {
  const errors: string[] = [];
  
  // Validate budget
  const budget = Number(config['budget'] ?? 100);
  if (!Number.isFinite(budget) || budget < 10) {
    errors.push(`Budget must be at least 10 (got: ${budget}). Recommended: 50-200 for meaningful optimization.`);
  }
  
  // Validate data split
  const paretoSize = Number(config['paretoSize'] ?? Math.max(4, Math.floor(dtrainLength / 5)));
  const holdoutSize = Number(config['holdoutSize'] ?? 0);
  const minibatchSize = Number(config['minibatchSize'] ?? 4);
  
  if (paretoSize + holdoutSize >= dtrainLength) {
    errors.push(`Data split impossible: paretoSize=${paretoSize} + holdoutSize=${holdoutSize} >= total prompts=${dtrainLength}. Need at least 1 prompt for feedback.`);
  }
  
  if (minibatchSize > dtrainLength - paretoSize - holdoutSize) {
    errors.push(`Minibatch size (${minibatchSize}) too large for available feedback prompts (${dtrainLength - paretoSize - holdoutSize}).`);
  }
  
  if (paretoSize < 1) {
    errors.push(`Pareto size must be at least 1 (got: ${paretoSize}).`);
  }
  
  // Validate models
  const actorModel = String(config['actorModel'] ?? 'gpt-5-mini');
  const judgeModel = String(config['judgeModel'] ?? 'gpt-5-mini');
  
  if (!actorModel || !judgeModel) {
    errors.push('Both actorModel and judgeModel must be specified.');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }
}

/**
 * Apply sensible defaults to configuration
 */
function applyDefaults(config: Record<string, unknown>, dtrainLength: number): Record<string, unknown> {
  const defaults = {
    actorModel: 'gpt-5-mini',
    judgeModel: 'gpt-5-mini',
    budget: Math.max(50, dtrainLength * 3), // At least 3 iterations per prompt
    minibatchSize: Math.min(4, Math.max(1, Math.floor(dtrainLength / 4))),
    paretoSize: Math.max(2, Math.floor(dtrainLength / 3)),
    holdoutSize: Math.max(0, Math.floor(dtrainLength / 6)),
    epsilonHoldout: 0.02,
    actorTemperature: 0.4,
    actorMaxTokens: 512,
    rubric: 'Correctness, coverage, safety, brevity.',
    strategiesPath: DEFAULT_STRATEGIES_PATH,
    scoreForPareto: 'muf',
    mufCosts: true,
    crossoverProb: 0
  };
  
  return { ...defaults, ...config };
}

/**
 * Parse input with support for new format: { system?: string, modules?: [{id,prompt}], prompts: [...] }
 * Validates input structure and handles fallbacks
 */
function parseInput(inputRaw: Record<string, unknown>): { system: string; prompts: Array<Partial<TaskItem>> } {
  // Validate that prompts array exists
  if (!inputRaw.prompts || !Array.isArray(inputRaw.prompts)) {
    throw new Error('Input must contain a "prompts" array');
  }

  // Handle system prompt (backward compatibility)
  if (inputRaw.system && typeof inputRaw.system === 'string') {
    return {
      system: inputRaw.system,
      prompts: inputRaw.prompts as Array<Partial<TaskItem>>
    };
  }

  // Handle modules
  if (inputRaw.modules && Array.isArray(inputRaw.modules)) {
    // Validate modules structure
    for (const module of inputRaw.modules) {
      if (!module || typeof module !== 'object') {
        throw new Error('Each module must be an object');
      }
      if (!('id' in module) || typeof module.id !== 'string' || module.id.trim() === '') {
        throw new Error('Each module must have a string "id"');
      }
      if (!('prompt' in module) || typeof module.prompt !== 'string') {
        throw new Error('Each module must have a string "prompt"');
      }
    }
    
    // Concatenate modules into system prompt
    const system = (inputRaw.modules as Array<{ id: string; prompt: string }>)
      .map(m => m.prompt)
      .join('\n\n');
    
    return {
      system,
      prompts: inputRaw.prompts as Array<Partial<TaskItem>>
    };
  }

  throw new Error('Input must contain either "system" or "modules"');
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const cur = argv[i];
    if (cur.startsWith('--')) {
      const key = cur.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

function printHelp(): void {
  console.log(`
GEPA Prompt Optimizer

Usage: gepa [options]

Required Options:
  --input <file>           Input JSON file with prompts and system/modules
  --config <file>          Configuration JSON file
  --api-key <key>          OpenAI API key (or set OPENAI_API_KEY env var)

Optional Options:
  --runs-root <dir>        Directory for run outputs (default: runs)
  --resume <dir>           Resume from a previous run directory
  --out <file>             Output file for best system prompt
  --log                    Enable logging
  --log-level <level>      Log level: debug, info, warn, error (default: info)

Input Format:
  {
    "system": "Your system prompt",
    "prompts": [
      {"id": "1", "user": "User question 1"},
      {"id": "2", "user": "User question 2"}
    ]
  }

  OR for modular systems:
  {
    "modules": [
      {"id": "intro", "prompt": "Introduction module"},
      {"id": "main", "prompt": "Main module"}
    ],
    "prompts": [...]
  }

Configuration Options:
  actorModel              OpenAI model for execution (default: gpt-5-mini)
  judgeModel              OpenAI model for evaluation (default: gpt-5-mini)
  budget                  Total LLM calls allowed (default: 50+)
  minibatchSize           Feedback batch size (default: 4)
  paretoSize              Pareto evaluation size (default: 2+)
  holdoutSize             Holdout evaluation size (default: 0)
  epsilonHoldout          Holdout improvement threshold (default: 0.02)
  actorTemperature        Execution temperature (default: 0.4)
  actorMaxTokens          Max tokens for execution (default: 512)
  rubric                  Evaluation criteria (default: "Correctness, coverage, safety, brevity.")
  strategiesPath          Path to strategies file (default: strategies/strategies.json)
  scoreForPareto          Scoring method: "mu" or "muf" (default: "muf")
  mufCosts                Whether judge calls count toward budget (default: true)
  crossoverProb           Probability of crossover vs mutation (default: 0)

Examples:
  gepa --input examples/input.math.prompts.json --config examples/config.json --api-key sk-...
  gepa --input input.json --config config.json --log --log-level debug
  gepa --resume runs/2024-01-01T12-00-00Z-my-run
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  
  // Handle help
  if (args.help || args.h) {
    printHelp();
    return;
  }
  
  const runsRoot = args['runs-root'] || 'runs';
  const resumeDir = args.resume && args.resume !== 'true' ? args.resume : null;
  const logEnabled = args.log !== undefined && args.log !== 'false';
  const logLevel: LogLevel = (args['log-level'] as LogLevel) || 'info';
  const logger = createLogger(logEnabled, logLevel);

  let runCtx: Awaited<ReturnType<typeof resumeRun>> | Awaited<ReturnType<typeof initRun>>;
  let unlock: (() => Promise<void>) | undefined;

  try {
    if (resumeDir) {
      logger.step('Resume run', resumeDir);
      runCtx = await resumeRun(resumeDir);
      unlock = await acquireLock(runCtx.runDir);
    } else {
      if (!args.input || !args.config) { 
        console.error('Missing --input or --config. Use --help for usage information.'); 
        process.exit(1); 
      }
      
      const inputPath = path.resolve(args.input);
      const configPath = path.resolve(args.config);
      
      // Parse input and config files
      const inputRaw = JSON.parse(await fs.readFile(inputPath, 'utf8')) as Record<string, unknown>;
      const input = parseInput(inputRaw);
      const configRaw = JSON.parse(await fs.readFile(configPath, 'utf8')) as Record<string, unknown>;
      
      // Apply defaults and validate
      const config = applyDefaults(configRaw, input.prompts.length);
      validateConfig(config, input.prompts.length);
      
      const outPath = args.out ? path.resolve(args.out) : null;
      runCtx = await initRun({ runsRoot, inputObj: { ...input, originalInput: inputRaw }, configObj: config, outFile: outPath });
      logger.step('Init run', runCtx.runDir);
      unlock = await acquireLock(runCtx.runDir);
    }

    const config = (runCtx as any).configObj ?? JSON.parse(await fs.readFile(path.join(runCtx.runDir, 'config.json'), 'utf8'));

    const cliApiKey = args['api-key'] && args['api-key'] !== 'true' ? String(args['api-key']) : undefined;
    const apiKey = cliApiKey || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key required. Set --api-key or OPENAI_API_KEY environment variable.');
    }
    
    logger.info('Building OpenAI clients');
    const { actorLLM, chatLLM } = makeOpenAIClients({
      apiKey,
      actorModel: String(config['actorModel'] ?? 'gpt-5-mini'),
      judgeModel: String(config['judgeModel'] ?? 'gpt-5-mini'),
      temperature: Number(config['actorTemperature'] ?? 0.4),
      maxTokens: Number(config['actorMaxTokens'] ?? 512),
      ...(typeof config['baseURL'] === 'string' ? { baseURL: String(config['baseURL']) } : {}),
      ...(typeof config['requestTimeoutMs'] === 'number' ? { requestTimeoutMs: Number(config['requestTimeoutMs']) } : {})
    });

    // executor (actor)
    const execute: GepaOptions['execute'] = async ({ candidate, item }) => {
      // Handle both system and modular candidates
      const systemPrompt = candidate.system || (candidate.modules ? concatenateModules(candidate) : '');
      const prompt = [
        'SYSTEM:\n' + systemPrompt,
        'USER:\n' + item.user,
        'ASSISTANT:'
      ].join('\n\n');
      const content = await actorLLM.complete(prompt);
      return { output: content, traces: { system: systemPrompt } };
    };

    // metrics (judge)
    const rubric = String(config['rubric'] ?? 'Correctness, coverage, safety, brevity.');
    const mu: MetricMu = () => 0; // placeholder numeric (Pareto over judge is okay if you have none)
    const muf: FeedbackMuF = async ({ item, output, traces }) => {
      const system = (traces as any)?.system ?? (runCtx as any).state?.Psystems?.at(-1) ?? (runCtx as any).inputObj?.system;
      const j = await judgeScore(chatLLM, rubric, String(system), item.user, output);
      return { score: j.score, feedbackText: j.feedback };
    };

    // Create seed candidate - support both system and modules
    const originalInput = (runCtx as any).inputObj?.originalInput;
    const seed: Candidate = originalInput?.modules && Array.isArray(originalInput.modules)
      ? { modules: originalInput.modules as Array<{ id: string; prompt: string }> }
      : { system: (runCtx as any).inputObj?.system };
    const dtrain: TaskItem[] = (runCtx as any).inputObj?.prompts?.map((p: any, i: number) => ({
      id: p.id ? String(p.id) : String(i + 1),
      user: String(p.user),
      meta: p.meta ?? null
    })) || [];

    // Track statistics for detailed logging
    let initialScore = 0;
    let finalScore = 0;
    let iterationsCompleted = 0;
    let candidatesGenerated = 0;
    let acceptedCandidates = 0;
    let crossoverOperations = 0;
    let mutationOperations = 0;
    let strategySwitches = 0;
    const totalBudget = (runCtx as any).state?.budgetLeft || Number(config['budget'] ?? 100);

    async function onCheckpoint(state: any, iterPayload: any): Promise<void> {
      await saveIteration(path.join((runCtx as any).runDir, 'iterations'), iterPayload.iter ?? state.iter, iterPayload);
      await saveState((runCtx as any).runDir, state);
      const best = state.Psystems[state.bestIdx];
      await writeJsonAtomic(path.join((runCtx as any).runDir, 'best.json'), { system: best, bestIdx: state.bestIdx, iter: state.iter });
      const outPath = (runCtx as any).outPath || null;
      if (outPath) await fs.writeFile(outPath, best, 'utf8');
      logger.debug('Persisted checkpoint to disk');

      // Update statistics
      iterationsCompleted = state.iter;
      candidatesGenerated = state.Psystems.length;
      if (iterPayload.accepted) {
        acceptedCandidates++;
        if (iterPayload.operationType === 'crossover') {
          crossoverOperations++;
        } else {
          mutationOperations++;
        }
      }
      if (iterPayload.strategySwitch) {
        strategySwitches++;
      }

      // Log detailed iteration statistics when logging is enabled
      if (logEnabled && logLevel === 'info') {
        const currentScore = state.S[state.bestIdx] ? state.S[state.bestIdx].reduce((a: number, b: number) => a + b, 0) / state.S[state.bestIdx].length : 0;
        const improvement = calculateImprovement(initialScore, currentScore);
        
        logger.info(`📈 Iteration ${iterPayload.iter}: Score=${currentScore.toFixed(3)} (${improvement.percentage >= 0 ? '+' : ''}${improvement.percentage.toFixed(1)}%) | Accepted=${iterPayload.accepted} | Operation=${iterPayload.operationType || 'mutation'} | Budget=${state.budgetLeft}/${totalBudget}`);
      }
    }

    // Evaluate initial performance for baseline
    if (logEnabled) {
      logger.info('🔍 Evaluating initial system performance...');
      const initialScores: number[] = [];
      const paretoSize = Number(config['paretoSize'] ?? Math.max(4, Math.floor(dtrain.length / 5)));
      const paretoItems = dtrain.slice(0, paretoSize);
      
      for (const item of paretoItems) {
        const { output } = await execute({ candidate: seed, item });
        const feedback = await muf({ item, output, traces: null });
        initialScores.push(feedback.score);
      }
      
      initialScore = initialScores.reduce((a, b) => a + b, 0) / initialScores.length;
      logger.info(`📊 Initial Performance: ${initialScore.toFixed(3)} (average over ${paretoItems.length} Pareto items)`);
    }

    const best = await runGEPA_System(seed, dtrain, {
      execute, mu, muf, llm: actorLLM,
      budget: (runCtx as any).state?.budgetLeft || Number(config['budget'] ?? 100),
      minibatchSize: Number(config['minibatchSize'] ?? 4),
      paretoSize: Number(config['paretoSize'] ?? Math.max(4, Math.floor(dtrain.length / 5))),
      holdoutSize: Number(config['holdoutSize'] ?? 0),
      epsilonHoldout: Number(config['epsilonHoldout'] ?? 0.02),
      ...(config['strategiesPath'] ? { strategiesPath: String(config['strategiesPath']) } : { strategiesPath: DEFAULT_STRATEGIES_PATH }),
      ...(config['scoreForPareto'] === 'mu' ? { scoreForPareto: 'mu' as const } : { scoreForPareto: 'muf' as const }),
      mufCosts: config['mufCosts'] === undefined ? true : Boolean(config['mufCosts']),
      crossoverProbability: Number(config['crossoverProb'] ?? 0)
    }, { state: (runCtx as any).state, onCheckpoint, logger });

    // Evaluate final performance
    if (logEnabled) {
      logger.info('🔍 Evaluating final system performance...');
      const finalScores: number[] = [];
      const paretoSize = Number(config['paretoSize'] ?? Math.max(4, Math.floor(dtrain.length / 5)));
      const paretoItems = dtrain.slice(0, paretoSize);
      
      for (const item of paretoItems) {
        const { output } = await execute({ candidate: best, item });
        const feedback = await muf({ item, output, traces: null });
        finalScores.push(feedback.score);
      }
      
      finalScore = finalScores.reduce((a, b) => a + b, 0) / finalScores.length;
      
      // Calculate budget used
      const budgetUsed = totalBudget - ((runCtx as any).state?.budgetLeft || 0);
      
      // Get data split information
      const paretoSizeConfig = Number(config['paretoSize'] ?? Math.max(4, Math.floor(dtrain.length / 5)));
      const holdoutSizeConfig = Number(config['holdoutSize'] ?? 0);
      const feedbackSize = dtrain.length - paretoSizeConfig - holdoutSizeConfig;
      
      // Log comprehensive statistics
      const stats = {
        initialScore,
        finalScore,
        iterations: iterationsCompleted,
        budgetUsed,
        totalBudget,
        candidatesGenerated,
        acceptedCandidates,
        crossoverOperations,
        mutationOperations,
        strategySwitches,
        paretoSize: paretoSizeConfig,
        feedbackSize,
        holdoutSize: holdoutSizeConfig
      };
      
      logger.info('\n' + formatStats(stats));
      
      // Save statistics to run directory
      await writeJsonAtomic(
        path.join((runCtx as any).runDir, 'statistics.json'), 
        { ...stats, improvement: calculateImprovement(initialScore, finalScore) }
      );
    }

    // Print final best to stdout
    const bestOutput = best.system || (best.modules ? concatenateModules(best) : '');
    console.log(bestOutput);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    if (logEnabled && logLevel === 'debug') {
      console.error(error instanceof Error ? error.stack : '');
    }
    process.exit(1);
  } finally {
    if (unlock) await unlock();
  }
}

// Export for tests
export { parseArgs, main, parseInput, validateConfig, applyDefaults, printHelp, calculateImprovement, formatStats };

// Run when invoked directly (not when imported by tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main().catch(err => { console.error(err); process.exit(1); });
}


