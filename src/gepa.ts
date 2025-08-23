import { selectCandidate } from './selection.js';
import { proposeNewModule, type JudgedExample, summarizeTraces } from './reflection.js';
import { UCB1 } from './bandit.js';
import { seedPopulation, type StrategyDef } from './seeding.js';
import type {
  Candidate, TaskItem, GepaOptions, GEPAState, StrategyScheduleOptions, RunPersist
} from './types.js';
import * as fs from 'node:fs/promises';
import { type Logger, silentLogger } from './logger.js';
import { prefilterStrategies } from './strategy.js';
import { loadStrategyLog, saveStrategyLog, updateStrategyLog } from './globalStrategyLog.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BudgetTracker } from './budget.js';
import { sampleMinibatch, avg, argmax } from './gepa/helpers.js';
import { initializeState } from './gepa/state.js';
import { runOptimizationLoop } from './gepa/loop.js';
import { 
  isModular, 
  isSingleSystem, 
  getModuleCount, 
  serializeCandidate, 
  deserializeCandidate,
  validateCandidate,
  mergeCandidates,
  areDirectRelatives,
  hasBeenTriedBefore,
  findSharedAncestor,
  hasModuleNovelty
} from './modules.js';

// Default built-in strategies file packaged with the module (dist is sibling to strategies)
export const DEFAULT_STRATEGIES_PATH: string = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../strategies/strategies.json'
);


/** Optimize a single system prompt with GEPA + strategy bandit + holdout gates. */
export async function runGEPA_System(
  seed: Candidate,
  dtrain: TaskItem[],
  opts: GepaOptions,
  persist?: RunPersist
): Promise<Candidate> {
  const {
    execute, mu, muf, llm,
    budget, minibatchSize: b, paretoSize: nPareto,
    holdoutSize = 0, epsilonHoldout = 0.02, strategiesPath = DEFAULT_STRATEGIES_PATH,
    scoreForPareto = 'muf',
    mufCosts = true
  } = opts;
  const logger: Logger = persist?.logger ?? silentLogger;
  logger.step('GEPA start', `budget=${budget}, pareto=${nPareto}, minibatch=${b}`);

  // Validate inputs
  if (dtrain.length === 0) {
    throw new Error('Training data cannot be empty');
  }
  
  if (budget < 10) {
    throw new Error(`Budget too small: ${budget}. Need at least 10 for meaningful optimization.`);
  }

  // Budget tracker: enabled and authoritative for decrements
  const startBudget = persist?.state?.budgetLeft ?? budget;
  const budgetTracker = new BudgetTracker(startBudget, true);
  
  logger.info(`Budget initialization: startBudget=${startBudget}, budget=${budget}, tracker.remaining()=${budgetTracker.remaining()}`);

  // Validate seed candidate
  validateCandidate(seed);

  const { state, P, S, Dpareto, Dhold, Dfb, scoreParetoRow } = await initializeState(
    seed, dtrain, opts, persist, logger, budgetTracker
  );

  // Strategies + bandit
  const strategiesRaw: StrategyDef[] = JSON.parse(await fs.readFile(strategiesPath, 'utf8')) as StrategyDef[];
  let activeStrategies: StrategyDef[] = [...strategiesRaw];
  let bandit = state.bandit ? UCB1.from(state.bandit) : new UCB1(activeStrategies.map(s => s.id));

  // Adaptive scheduler state
  const scheduleOpts: Required<StrategyScheduleOptions> = {
    windowSize: opts.strategySchedule?.windowSize ?? 8,
    slowdownThreshold: opts.strategySchedule?.slowdownThreshold ?? 0.01,
    baseExploreProb: opts.strategySchedule?.baseExploreProb ?? 0.1,
    maxExploreProb: opts.strategySchedule?.maxExploreProb ?? 0.6,
    baseNoHintProb: opts.strategySchedule?.baseNoHintProb ?? 0.15,
    maxNoHintProb: opts.strategySchedule?.maxNoHintProb ?? 0.4,
    defaultCoreTopK: opts.strategySchedule?.defaultCoreTopK ?? 6,
    prefilterThreshold: opts.strategySchedule?.prefilterThreshold ?? 0.3,
    prefilterTopK: opts.strategySchedule?.prefilterTopK ?? 10,
    reprefilterCooldownIters: opts.strategySchedule?.reprefilterCooldownIters ?? 6
  };
  const upliftWindow: number[] = [];
  const pushUplift = (u: number) => {
    upliftWindow.push(u);
    if (upliftWindow.length > scheduleOpts.windowSize) upliftWindow.shift();
  };
  const recentAvgUplift = (): number => upliftWindow.length ? upliftWindow.reduce((a, b) => a + b, 0) / upliftWindow.length : 0;
  const calcExploreProb = (): number => {
    const avgU = recentAvgUplift();
    if (avgU <= scheduleOpts.slowdownThreshold) return scheduleOpts.maxExploreProb;
    // Linearly interpolate between base and max around threshold -> generous exploration as gains slow
    const ratio = Math.max(0, Math.min(1, (scheduleOpts.slowdownThreshold / avgU)));
    return Math.min(scheduleOpts.maxExploreProb, scheduleOpts.baseExploreProb + (scheduleOpts.maxExploreProb - scheduleOpts.baseExploreProb) * ratio);
  };
  const calcNoHintProb = (): number => {
    const avgU = recentAvgUplift();
    if (avgU <= scheduleOpts.slowdownThreshold) return scheduleOpts.maxNoHintProb;
    const ratio = Math.max(0, Math.min(1, (scheduleOpts.slowdownThreshold / avgU)));
    return Math.min(scheduleOpts.maxNoHintProb, scheduleOpts.baseNoHintProb + (scheduleOpts.maxNoHintProb - scheduleOpts.baseNoHintProb) * ratio);
  };

  // Load global strategy log
  const strategyLog = await loadStrategyLog();

  // Prefilter strategies initially against the training corpus preview
  const prefilterCfg = {
    threshold: opts.strategySchedule?.prefilterThreshold ?? 0.3,
    topK: opts.strategySchedule?.prefilterTopK ?? 10,
    log: strategyLog,
    logWeight: opts.strategySchedule?.globalLogWeight ?? 0.5,
  };
  const previewTexts = Dpareto.concat(Dfb).slice(0, 12).map(x => x.user);
  if (previewTexts.length > 0 && strategiesRaw.length > 0) {
    try {
      const pf = await prefilterStrategies(llm, strategiesRaw as any, previewTexts, prefilterCfg);
      if (pf.kept.length > 0) {
        activeStrategies = pf.kept as StrategyDef[];
        bandit = new UCB1(activeStrategies.map(s => s.id));
        logger.info(`Prefiltered strategies: kept=${activeStrategies.length}/${strategiesRaw.length}`);
      }
    } catch (e) {
      logger.warn(`Prefilter failed; using all strategies (${(e as Error).message})`);
      activeStrategies = [...strategiesRaw];
    }
  }

  // Re-prefilter trigger when stagnating for N iterations
  let lastPrefilterIter = 0;
  const reprefilterCooldown = opts.strategySchedule?.reprefilterCooldownIters ?? 6;

  // Initialize lineage tracking
  if (!state.lineage) {
    state.lineage = [];
  }
  
  // Track tried merge triplets to avoid repetition
  const triedTriplets: Array<[number, number, number]> = [];

  // One-time seeding with top-K strategies (screen subset of feedback set)
  if (!state.seeded && Dfb.length) {
    logger.step('Seeding population');
    const screen = Dfb.slice(0, Math.max(3, Math.floor(Dfb.length * 0.1)));
    
    // Calculate budget needed for seeding
    const seedingCallsPerStrategy = screen.length * 2 + 1; // execute + judge + propose
    const maxStrategies = Math.min(6, activeStrategies.length);
    const totalSeedingCalls = seedingCallsPerStrategy * maxStrategies;
    
    // Reserve budget for at least one full iteration (before+after judge calls)
    const iterationCalls = 2 * b + 2; // before execute + before judge + after execute + after judge + propose
    const reserveCalls = Math.max(iterationCalls, 10); // At least 10 calls for meaningful optimization
    
    // Account for the fact that we already spent budget on Pareto evaluation
    const currentBudget = budgetTracker.remaining();
    const allowedForSeeding = Math.min(
      currentBudget - reserveCalls,
      totalSeedingCalls
    );
    
    logger.info(`Budget check: current=${currentBudget}, seeding needs=${seedingCallsPerStrategy}, reserve=${reserveCalls}, allowed=${allowedForSeeding}`);
    
    if (allowedForSeeding < seedingCallsPerStrategy) {
      logger.warn(`Insufficient budget for seeding (${allowedForSeeding} < ${seedingCallsPerStrategy}). Skipping seeding.`);
    } else {
      const seeded = await seedPopulation({
        seed: { system: state.Psystems[0] }, screen, strategies: activeStrategies,
        K: Math.min(6, activeStrategies.length), execute, muf, llm,
        budgetLeft: allowedForSeeding,
        mufCosts
      });
      // Precisely decrement by measured usedCalls
      if (seeded.usedCalls > 0) budgetTracker.dec(seeded.usedCalls, 'seeding');
      state.budgetLeft = budgetTracker.remaining();
      for (const c of seeded.candidates.slice(1)) {
        P.push(c);
        state.Psystems.push(serializeCandidate(c));
        const row = await scoreParetoRow(c);
        S.push(row);
      }
      state.bestIdx = argmax(S.map(r => avg(r)));
      state.seeded = true;
      logger.info(`Seeded +${Math.max(0, seeded.candidates.length - 1)} candidates (screen=${screen.length}) calls=${seeded.usedCalls}`);
      if (persist?.onCheckpoint) await persist.onCheckpoint(state, { iter: state.iter, seeded: true });
    }
  }

  // Helper: holdout average judge score
  const avgHoldout = async (cand: Candidate): Promise<number> => {
    if (!Dhold.length) return 0;
    const scores: number[] = [];
    for (const item of Dhold) {
      if (!budgetTracker.canAfford(1)) break;
      const { output, traces } = await execute({ candidate: cand, item });
      budgetTracker.dec(1, 'holdout:execute');
      if (mufCosts && !budgetTracker.canAfford(1)) break;
      const jf = await opts.muf({ item, output, traces: traces ?? null });
      if (mufCosts) budgetTracker.dec(1, 'holdout:muf');
      scores.push(jf.score);
    }
    return avg(scores);
  };


  const iterationsRun = await runOptimizationLoop({
    state,
    P,
    S,
    Dfb,
    Dhold,
    dtrain,
    opts,
    budgetTracker,
    logger,
    persist,
    strategiesRaw,
    activeStrategies,
    bandit,
    scheduleOpts,
    upliftWindow,
    pushUplift,
    recentAvgUplift,
    calcExploreProb,
    calcNoHintProb,
    lastPrefilterIter,
    reprefilterCooldown,
    triedTriplets,
    avgHoldout,
    scoreParetoRow,
    previewTexts,
    prefilterCfg,
  });

  logger.step(
    'GEPA done',
    `bestIdx=${state.bestIdx} iterations=${iterationsRun} budgetUsed=${
      startBudget - budgetTracker.remaining()
    }`
  );

  // Update and save the global strategy log
  if (state.bandit) {
    const updatedLog = updateStrategyLog(strategyLog, state.bandit.stats);
    await saveStrategyLog(updatedLog);
    logger.info('Global strategy log updated.');
  }

  return P[state.bestIdx];
}



