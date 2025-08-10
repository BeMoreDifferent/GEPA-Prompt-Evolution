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
      const moduleObj = module as Record<string, unknown>;
      if (!moduleObj.id || typeof moduleObj.id !== 'string') {
        throw new Error('Each module must have a string "id"');
      }
      if (!moduleObj.prompt || typeof moduleObj.prompt !== 'string') {
        throw new Error('Each module must have a string "prompt"');
      }
    }

    // Concatenate modules into system prompt for backward compatibility
    const modules = inputRaw.modules as Array<{ id: string; prompt: string }>;
    const systemPrompt = modules.map(m => m.prompt).join('\n\n');
    
    return {
      system: systemPrompt,
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
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
      if (!args.input || !args.config) { console.error('Missing --input or --config'); process.exit(1); }
      
      // Parse input with support for new format: { system?: string, modules?: [{id,prompt}], prompts: [...] }
      const inputRaw = JSON.parse(await fs.readFile(args.input, 'utf8')) as Record<string, unknown>;
      const input = parseInput(inputRaw);
      
      const config = JSON.parse(await fs.readFile(args.config, 'utf8')) as Record<string, unknown>;
      const outPath = args.out ? path.resolve(args.out) : null;
      runCtx = await initRun({ runsRoot, inputObj: { ...input, originalInput: inputRaw }, configObj: config, outFile: outPath });
      logger.step('Init run', runCtx.runDir);
      unlock = await acquireLock(runCtx.runDir);
    }

    const input = (runCtx as any).inputObj ?? JSON.parse(await fs.readFile(path.join(runCtx.runDir, 'input.json'), 'utf8'));
    const config = (runCtx as any).configObj ?? JSON.parse(await fs.readFile(path.join(runCtx.runDir, 'config.json'), 'utf8'));

    const cliApiKey = args['api-key'] && args['api-key'] !== 'true' ? String(args['api-key']) : undefined;
    logger.info('Building OpenAI clients');
    const { actorLLM, chatLLM } = makeOpenAIClients({
      ...(cliApiKey ? { apiKey: cliApiKey } : process.env.OPENAI_API_KEY ? { apiKey: process.env.OPENAI_API_KEY } : {}),
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
      const system = (traces as any)?.system ?? (runCtx as any).state?.Psystems?.at(-1) ?? input.system;
      const j = await judgeScore(chatLLM, rubric, String(system), item.user, output);
      return { score: j.score, feedbackText: j.feedback };
    };

    // Create seed candidate - support both system and modules
    const originalInput = (runCtx as any).inputObj?.originalInput;
    const seed: Candidate = originalInput?.modules && Array.isArray(originalInput.modules)
      ? { modules: originalInput.modules as Array<{ id: string; prompt: string }> }
      : { system: input.system };
    const dtrain: TaskItem[] = input.prompts.map((p: any, i: number) => ({
      id: p.id ? String(p.id) : String(i + 1),
      user: String(p.user),
      meta: p.meta ?? null
    }));

    async function onCheckpoint(state: any, iterPayload: any): Promise<void> {
      await saveIteration(path.join((runCtx as any).runDir, 'iterations'), iterPayload.iter ?? state.iter, iterPayload);
      await saveState((runCtx as any).runDir, state);
      const best = state.Psystems[state.bestIdx];
      await writeJsonAtomic(path.join((runCtx as any).runDir, 'best.json'), { system: best, bestIdx: state.bestIdx, iter: state.iter });
      const outPath = (runCtx as any).outPath || null;
      if (outPath) await fs.writeFile(outPath, best, 'utf8');
      logger.debug('Persisted checkpoint to disk');
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

    // Print final best to stdout
    console.log(best.system);
  } finally {
    if (unlock) await unlock();
  }
}

// Export for tests
export { parseArgs, main, parseInput };

// Run when invoked directly (not when imported by tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main().catch(err => { console.error(err); process.exit(1); });
}


