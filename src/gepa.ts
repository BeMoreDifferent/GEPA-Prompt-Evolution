import { selectCandidate } from './selection.js';
import { proposeNewSystem, proposeNewModule, type JudgedExample, summarizeTraces } from './reflection.js';
import { UCB1 } from './bandit.js';
import { seedPopulation, type StrategyDef } from './seeding.js';
import type {
  Candidate, TaskItem, GepaOptions, GEPAState, StrategyScheduleOptions
} from './types.js';
import * as fs from 'node:fs/promises';
import { type Logger, silentLogger } from './logger.js';
import { prefilterStrategies } from './strategy.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BudgetTracker } from './budget.js';
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

type PersistHook = (state: GEPAState, iterPayload: Record<string, unknown>) => Promise<void>;

export interface RunPersist {
  state?: GEPAState;
  onCheckpoint?: PersistHook;
  logger?: Logger;
}

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

  // Budget tracker: enabled and authoritative for decrements
  const startBudget = persist?.state?.budgetLeft ?? budget;
  const budgetTracker = new BudgetTracker(startBudget, true);

  // Validate seed candidate
  validateCandidate(seed);

  // ---- resume or fresh ----
  let state: GEPAState = persist?.state ?? {
    version: 2,
    budgetLeft: budget,
    iter: 0,
    Psystems: [serializeCandidate(seed)],
    S: [],
    DparetoIdx: [],
    DfbIdx: [],
    DholdIdx: [],
    bestIdx: 0,
    seeded: false,
    bandit: null,
    moduleIndex: 0,
    moduleCount: getModuleCount(seed)
  };

  // Split once, then store indices for determinism across resumes
  if (state.DparetoIdx.length === 0 && state.DfbIdx.length === 0) {
    const idx = [...dtrain.keys()];
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    // Ensure at least one feedback item when possible
    const total = idx.length;
    const paretoEff = Math.min(nPareto, Math.max(1, total > 1 ? total - 1 : total));
    const holdMax = Math.max(0, total - paretoEff - 1);
    const holdEff = Math.min(holdoutSize, holdMax);
    state.DparetoIdx = idx.slice(0, paretoEff);
    state.DholdIdx   = idx.slice(paretoEff, paretoEff + holdEff);
    state.DfbIdx     = idx.slice(paretoEff + holdEff);
    state.budgetLeft = state.budgetLeft || budget;
  }
  const Dpareto = state.DparetoIdx.map(i => dtrain[i]);
  const Dhold   = state.DholdIdx.map(i => dtrain[i]);
  let   Dfb     = state.DfbIdx.map(i => dtrain[i]);
  logger.info(`Split: pareto=${Dpareto.length}, holdout=${Dhold.length}, feedback=${Dfb.length}`);
  if (Dfb.length === 0 && Dpareto.length > 0) {
    // Fallback: reuse Pareto items as feedback for tiny datasets
    Dfb = [...Dpareto];
    logger.warn('Feedback set empty; falling back to use Pareto items for minibatches');
  }

  // Rebuild P and S
  const P: Candidate[] = state.Psystems.map(s => deserializeCandidate(s));
  const S: number[][] = state.S.length ? state.S : (state.S = []);

  // Helper to compute a Pareto row using configured scorer
  const scoreParetoRow = async (cand: Candidate): Promise<number[]> => {
    const row: number[] = [];
    for (const item of Dpareto) {
      if (!budgetTracker.canAfford(1)) break;
      const { output, traces } = await execute({ candidate: cand, item });
      budgetTracker.dec(1, 'pareto:execute');
      if (scoreForPareto === 'mu') {
        row.push(mu(output, item.meta ?? null));
      } else {
        if (mufCosts && !budgetTracker.canAfford(1)) break;
        const f = await muf({ item, output, traces: traces ?? null });
        if (mufCosts) budgetTracker.dec(1, 'pareto:muf');
        row.push(f.score);
      }
    }
    return row;
  };

  // Seed Pareto row for initial candidate if missing
  if (S.length === 0) {
    logger.step('Init Pareto row', `k=0 over ${Dpareto.length} items`);
    const row = await scoreParetoRow(P[0]);
    S.push(row);
  }

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

  // Prefilter strategies initially against the training corpus preview
  const prefilterCfg = {
    threshold: opts.strategySchedule?.prefilterThreshold ?? 0.3,
    topK: opts.strategySchedule?.prefilterTopK ?? 10
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
    // Reserve budget for at least one full iteration (before+after judge calls)
    const reserveCalls = Math.max(3, 2 * b);
    const allowedForSeeding = budgetTracker.remaining() > reserveCalls ? (budgetTracker.remaining() - reserveCalls) : 0;
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

  while (budgetTracker.remaining() > 0) {
    const k = selectCandidate(P, S);
    const parent = P[k];
    logger.step(`Iter ${state.iter + 1}`, `pick k=${k}`);

    // Minibatch over feedback set
    const M = sampleMinibatch(Dfb, b);
    const before: Array<{ id: string; score: number; feedback: string; output: string; execTrace?: string; evalTrace?: string }> = [];
    for (const item of M) {
      if (!budgetTracker.canAfford(1 + (mufCosts ? 1 : 0))) break;
      const { output, traces } = await execute({ candidate: parent, item });
      budgetTracker.dec(1, 'before:execute');
      const f = await opts.muf({ item, output, traces: traces ?? null });
      if (mufCosts) budgetTracker.dec(1, 'before:muf');
      const execTrace = summarizeTraces(traces, 1000);
      before.push({ 
        id: item.id, 
        score: f.score, 
        feedback: f.feedbackText, 
        output,
        ...(execTrace && { execTrace })
      });
    }
    const sigma = avg(before.map(x => x.score));
    state.budgetLeft = budgetTracker.remaining();
    if (budgetTracker.remaining() <= 0) break;

    // Decide between mutation and crossover
    const crossoverProb = opts.crossoverProbability ?? 0;
    let useCrossover = Math.random() < crossoverProb && P.length > 1;
    
    let child: Candidate = parent; // Default to parent
    let operationType: 'mutation' | 'crossover' = 'mutation';
    let doNoHint = false;
    let chosenId = '';
    let secondParentIndex: number | undefined;
    
    if (useCrossover) {
      // Crossover (merge) path
      logger.info('Using crossover (merge) operation');
      
      // Select second parent (different from first)
      do {
        secondParentIndex = selectCandidate(P, S);
      } while (secondParentIndex === k);
      
      const parentA = parent;
      const parentB = P[secondParentIndex];
      
      // Check if parents are direct relatives
      if (areDirectRelatives(k, secondParentIndex, state.lineage)) {
        logger.warn('Skipping crossover: parents are direct relatives');
        useCrossover = false;
      } else {
        // Find shared ancestor
        const ancestorIndex = findSharedAncestor(k, secondParentIndex, state.lineage);
        if (ancestorIndex === null) {
          logger.warn('Skipping crossover: no shared ancestor found');
          useCrossover = false;
        } else {
          // Check if this triplet has been tried before
          if (hasBeenTriedBefore(k, secondParentIndex, ancestorIndex, triedTriplets)) {
            logger.warn('Skipping crossover: triplet already tried');
            useCrossover = false;
          } else {
            // Get lineage information
            const lineageA = state.lineage.find(l => l.candidateIndex === k)?.changedModules ?? [];
            const lineageB = state.lineage.find(l => l.candidateIndex === secondParentIndex)?.changedModules ?? [];
            
            // Get scores for both parents
            const scoreA = avg(S[k]);
            const scoreB = avg(S[secondParentIndex]);
            
            // Perform merge
            child = mergeCandidates(parentA, parentB, lineageA, lineageB, scoreA, scoreB);
            
            // Check if merge introduces novelty
            if (!hasModuleNovelty(child, parentA, parentB, lineageA, lineageB)) {
              logger.warn('Skipping crossover: no module-level novelty');
              useCrossover = false;
            } else {
              // Record this triplet as tried
              triedTriplets.push([k, secondParentIndex, ancestorIndex]);
              operationType = 'crossover';
              
              logger.info(`Crossover: parentA=${k}, parentB=${secondParentIndex}, ancestor=${ancestorIndex}`);
            }
          }
        }
      }
    }
    
    if (!useCrossover) {
      // Mutation path (existing logic)
      operationType = 'mutation';
      
      // Mutate with chosen strategy
      // Decide exploration vs exploitation and whether to drop hints (pure GEPA reflection)
      const exploreProb = calcExploreProb();
      const noHintProb = calcNoHintProb();
      doNoHint = Math.random() < noHintProb;
      chosenId = bandit.pick();
      if (Math.random() < exploreProb) {
        // Explore: bias toward core strategies; if none marked, use top-K by list order
        const core: StrategyDef[] = (activeStrategies as Array<StrategyDef & { core?: boolean }>).filter(s => (s as any).core === true);
        const pool: StrategyDef[] = core.length ? core : activeStrategies.slice(0, Math.min(scheduleOpts.defaultCoreTopK, activeStrategies.length));
        chosenId = pool[Math.floor(Math.random() * pool.length)]?.id ?? chosenId;
      }
      logger.info(`Strategy: ${doNoHint ? 'no-hint' : chosenId}; minibatch size=${M.length} exploreProb=${exploreProb.toFixed(2)} noHintProb=${noHintProb.toFixed(2)}`);
      const hint = doNoHint ? '' : ((activeStrategies.find(s => s.id === chosenId)?.hint) ?? '');
      const examples: JudgedExample[] = before.map(x => ({
        user: dtrain.find(d => d.id === x.id)?.user ?? '',
        output: x.output,
        feedback: x.feedback,
        ...(x.execTrace && { execTrace: x.execTrace })
      }));
      if (!budgetTracker.canAfford(1)) break;
      
      // Round-robin module mutation
      const moduleIndex = state.moduleIndex ?? 0;
      const moduleCount = state.moduleCount ?? getModuleCount(parent);
      
      logger.info(`Mutating module ${moduleIndex + 1}/${moduleCount}`);
      
      child = await proposeNewModule(llm, parent, moduleIndex, examples, hint);
      budgetTracker.dec(1, 'propose');
      
      // Update module index for next iteration (round-robin)
      state.moduleIndex = (moduleIndex + 1) % moduleCount;
    }
    
    // Ensure child is assigned (fallback to parent if neither crossover nor mutation succeeded)
    if (!child) {
      child = parent;
      operationType = 'mutation';
    }
    
    const systemPreview = isSingleSystem(child) ? child.system : 
                         isModular(child) ? child.modules.map(m => m.prompt).join('\n\n') : '';
    logger.debug(`New system preview: ${(systemPreview || '').slice(0, 120)}`);

    // Re-evaluate on same minibatch
    const afterScores: number[] = [];
    for (const item of M) {
      if (!budgetTracker.canAfford(1 + (mufCosts ? 1 : 0))) break;
      const { output, traces } = await execute({ candidate: child, item });
      budgetTracker.dec(1, 'after:execute');
      const f = await opts.muf({ item, output, traces: traces ?? null });
      if (mufCosts) budgetTracker.dec(1, 'after:muf');
      afterScores.push(f.score);
    }
    const sigmaP = avg(afterScores);

    // Reward bandit: map [-1,1] -> [0,1]
    const reward = Math.max(0, Math.min(1, (sigmaP - sigma + 1) / 2));
    if (!doNoHint) bandit.update(chosenId, reward);
    pushUplift(sigmaP - sigma);
    logger.info(`Uplift: before=${sigma.toFixed(3)} after=${sigmaP.toFixed(3)} reward=${reward.toFixed(3)} budgetLeft=${state.budgetLeft}`);

    // If improvements are slowing down, consider re-prefiltering the strategy set
    if (recentAvgUplift() <= scheduleOpts.slowdownThreshold && (state.iter - lastPrefilterIter) >= reprefilterCooldown) {
      try {
        const pf = await prefilterStrategies(llm, strategiesRaw as any, previewTexts, prefilterCfg);
        if (pf.kept.length > 0) {
          activeStrategies = pf.kept as StrategyDef[];
          bandit = new UCB1(activeStrategies.map(s => s.id));
          state.bandit = bandit.serialize();
          lastPrefilterIter = state.iter;
          logger.step('Strategy switch', `kept=${activeStrategies.length}/${strategiesRaw.length}`);
        }
      } catch (e) {
        logger.warn(`Re-prefilter failed; keeping current strategies (${(e as Error).message})`);
      }
    }

    // Holdout gate
    let passHold = true;
    if (Dhold.length) {
      const holdParent = await avgHoldout(parent);
      const holdChild = await avgHoldout(child);
      passHold = holdChild + epsilonHoldout >= holdParent;
      logger.debug(`Holdout: parent=${holdParent.toFixed(3)} child=${holdChild.toFixed(3)} pass=${passHold}`);
    }

    const iterPayload = {
      iter: ++state.iter,
      strategyId: chosenId,
      minibatchIds: M.map(m => m.id),
      sigmaBefore: sigma,
      sigmaAfter: sigmaP,
      accepted: sigmaP > sigma && passHold,
      // persist minimal structured debug info (bounded size)
      before: before.map(x => ({ id: x.id, score: x.score, feedback: x.feedback.slice(0, 500) })),
      proposedSystem: (systemPreview || '').slice(0, 2000)
    };

    // Accept child → score on Pareto set
    if (iterPayload.accepted) {
      const newCandidateIndex = P.length;
      P.push(child);
      state.Psystems.push(serializeCandidate(child));
      const row = await scoreParetoRow(child);
      S.push(row);
      state.S = S;
      state.bestIdx = argmax(S.map(r => avg(r)));
      
      // Update lineage tracking
      if (operationType === 'mutation') {
        // For mutation, track which module was changed
        const moduleIndex = state.moduleIndex ?? 0;
        const moduleCount = state.moduleCount ?? getModuleCount(parent);
        const actualModuleIndex = (moduleIndex - 1 + moduleCount) % moduleCount; // Get the module that was actually mutated
        
        state.lineage.push({
          candidateIndex: newCandidateIndex,
          changedModules: [actualModuleIndex],
          parentIndex: k
        });
      } else if (operationType === 'crossover' && secondParentIndex !== undefined) {
        // For crossover, track modules from both parents
        const lineageA = state.lineage.find(l => l.candidateIndex === k)?.changedModules ?? [];
        const lineageB = state.lineage.find(l => l.candidateIndex === secondParentIndex)?.changedModules ?? [];
        const mergedModules = [...new Set([...lineageA, ...lineageB])]; // Union of changed modules
        
        state.lineage.push({
          candidateIndex: newCandidateIndex,
          changedModules: mergedModules,
          parentIndex: k // Primary parent
        });
      }
      
      logger.step('Accepted', `k=${newCandidateIndex} bestIdx=${state.bestIdx} operation=${operationType}`);
    } else {
      logger.warn('Rejected');
    }

    if (persist?.onCheckpoint) {
      await persist.onCheckpoint(state, iterPayload);
      logger.debug('Checkpoint saved');
    }
    state.bandit = bandit.serialize();
    state.budgetLeft = budgetTracker.remaining();
  }

  logger.step('GEPA done', `bestIdx=${state.bestIdx}`);
  return P[state.bestIdx];
}

function sampleMinibatch(arr: TaskItem[], n: number): TaskItem[] {
  if (n >= arr.length) return [...arr];
  const pick = new Set<number>(), out: TaskItem[] = [];
  while (out.length < n && pick.size < arr.length) {
    const i = Math.floor(Math.random() * arr.length);
    if (!pick.has(i)) { pick.add(i); out.push(arr[i]); }
  }
  return out;
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const argmax = (xs: number[]) => xs.reduce((bi, x, i, a) => (x > a[bi] ? i : bi), 0);


