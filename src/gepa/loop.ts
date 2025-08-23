import type {
  Candidate,
  TaskItem,
  GepaOptions,
  GEPAState,
  RunPersist,
  StrategyScheduleOptions,
  StrategyDef,
} from '../types.js';
import type { Logger } from '../logger.js';
import type { BudgetTracker } from '../budget.js';
import { UCB1 } from '../bandit.js';
import { selectCandidate } from '../selection.js';
import { sampleMinibatch, avg, argmax } from './helpers.js';
import {
  areDirectRelatives,
  findSharedAncestor,
  hasBeenTriedBefore,
  hasModuleNovelty,
  isModular,
  isSingleSystem,
  mergeCandidates,
  getModuleCount,
  serializeCandidate,
} from '../modules.js';
import { prefilterStrategies } from '../strategy.js';
import { summarizeTraces, JudgedExample, proposeNewModule } from '../reflection.js';

export interface LoopContext {
  state: GEPAState;
  P: Candidate[];
  S: number[][];
  Dfb: TaskItem[];
  Dhold: TaskItem[];
  dtrain: TaskItem[];
  opts: GepaOptions;
  budgetTracker: BudgetTracker;
  logger: Logger;
  persist?: RunPersist;
  strategiesRaw: StrategyDef[];
  activeStrategies: StrategyDef[];
  bandit: UCB1;
  scheduleOpts: Required<StrategyScheduleOptions>;
  upliftWindow: number[];
  pushUplift: (u: number) => void;
  recentAvgUplift: () => number;
  calcExploreProb: () => number;
  calcNoHintProb: () => number;
  lastPrefilterIter: number;
  reprefilterCooldown: number;
  triedTriplets: Array<[number, number, number]>;
  avgHoldout: (cand: Candidate) => Promise<number>;
  scoreParetoRow: (cand: Candidate) => Promise<number[]>;
  previewTexts: string[];
  prefilterCfg: any;
}

export async function runOptimizationLoop(
  context: LoopContext
): Promise<number> {
  let {
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
  } = context;

  const {
    execute,
    llm,
    budget,
    minibatchSize: b,
    mufCosts = true,
    epsilonHoldout = 0.02,
  } = opts;

  let iterationsRun = 0;
  const maxIterations = Math.floor(budget / (2 * b + 2));

  while (budgetTracker.remaining() > 0 && iterationsRun < maxIterations) {
    const k = selectCandidate(P, S);
    const parent = P[k];
    logger.step(
      `Iter ${state.iter + 1}`,
      `pick k=${k} (budget left: ${budgetTracker.remaining()})`
    );

    // Minibatch over feedback set
    const M = sampleMinibatch(Dfb, b);
    const before: Array<{
      id: string;
      score: number;
      feedback: string;
      output: string;
      execTrace?: string;
      evalTrace?: string;
    }> = [];
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
        ...(execTrace && { execTrace }),
      });
    }
    const sigma = avg(before.map((x) => x.score));
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
        const ancestorIndex = findSharedAncestor(
          k,
          secondParentIndex,
          state.lineage
        );
        if (ancestorIndex === null) {
          logger.warn('Skipping crossover: no shared ancestor found');
          useCrossover = false;
        } else {
          // Check if this triplet has been tried before
          if (
            hasBeenTriedBefore(k, secondParentIndex, ancestorIndex, triedTriplets)
          ) {
            logger.warn('Skipping crossover: triplet already tried');
            useCrossover = false;
          } else {
            // Get lineage information
            const lineageA =
              state.lineage.find((l) => l.candidateIndex === k)
                ?.changedModules ?? [];
            const lineageB =
              state.lineage.find((l) => l.candidateIndex === secondParentIndex)
                ?.changedModules ?? [];

            // Get scores for both parents
            const scoreA = avg(S[k]);
            const scoreB = avg(S[secondParentIndex]);

            // Perform merge
            child = mergeCandidates(
              parentA,
              parentB,
              lineageA,
              lineageB,
              scoreA,
              scoreB
            );

            // Check if merge introduces novelty
            if (
              !hasModuleNovelty(child, parentA, parentB, lineageA, lineageB)
            ) {
              logger.warn('Skipping crossover: no module-level novelty');
              useCrossover = false;
            } else {
              // Record this triplet as tried
              triedTriplets.push([k, secondParentIndex, ancestorIndex]);
              operationType = 'crossover';

              logger.info(
                `Crossover: parentA=${k}, parentB=${secondParentIndex}, ancestor=${ancestorIndex}`
              );
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
        const core: StrategyDef[] = (
          activeStrategies as Array<StrategyDef & { core?: boolean }>
        ).filter((s) => (s as any).core === true);
        const pool: StrategyDef[] = core.length
          ? core
          : activeStrategies.slice(
              0,
              Math.min(
                scheduleOpts.defaultCoreTopK,
                activeStrategies.length
              )
            );
        chosenId = pool[Math.floor(Math.random() * pool.length)]?.id ?? chosenId;
      }
      logger.info(
        `Strategy: ${
          doNoHint ? 'no-hint' : chosenId
        }; minibatch size=${M.length} exploreProb=${exploreProb.toFixed(
          2
        )} noHintProb=${noHintProb.toFixed(2)}`
      );
      const hint = doNoHint
        ? ''
        : activeStrategies.find((s) => s.id === chosenId)?.hint ?? '';
      const examples: JudgedExample[] = before.map((x) => ({
        user: dtrain.find((d) => d.id === x.id)?.user ?? '',
        output: x.output,
        feedback: x.feedback,
        ...(x.execTrace && { execTrace: x.execTrace }),
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

    const systemPreview = isSingleSystem(child)
      ? child.system
      : isModular(child)
      ? child.modules.map((m) => m.prompt).join('\n\n')
      : '';
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
    logger.info(
      `Uplift: before=${sigma.toFixed(3)} after=${sigmaP.toFixed(
        3
      )} reward=${reward.toFixed(3)} budgetLeft=${budgetTracker.remaining()}`
    );

    // If improvements are slowing down, consider re-prefiltering the strategy set
    if (
      recentAvgUplift() <= scheduleOpts.slowdownThreshold &&
      state.iter - lastPrefilterIter >= reprefilterCooldown
    ) {
      try {
        const pf = await prefilterStrategies(
          llm,
          strategiesRaw as any,
          previewTexts,
          prefilterCfg
        );
        if (pf.kept.length > 0) {
          activeStrategies = pf.kept as StrategyDef[];
          bandit = new UCB1(activeStrategies.map((s) => s.id));
          state.bandit = bandit.serialize();
          lastPrefilterIter = state.iter;
          logger.step(
            'Strategy switch',
            `kept=${activeStrategies.length}/${strategiesRaw.length}`
          );
        }
      } catch (e) {
        logger.warn(
          `Re-prefilter failed; keeping current strategies (${
            (e as Error).message
          })`
        );
      }
    }

    // Holdout gate
    let passHold = true;
    if (Dhold.length) {
      const holdParent = await avgHoldout(parent);
      const holdChild = await avgHoldout(child);
      passHold = holdChild + epsilonHoldout >= holdParent;
      logger.debug(
        `Holdout: parent=${holdParent.toFixed(
          3
        )} child=${holdChild.toFixed(3)} pass=${passHold}`
      );
    }

    const iterPayload = {
      iter: ++state.iter,
      strategyId: chosenId,
      minibatchIds: M.map((m) => m.id),
      sigmaBefore: sigma,
      sigmaAfter: sigmaP,
      accepted: sigmaP > sigma && passHold,
      // persist minimal structured debug info (bounded size)
      before: before.map((x) => ({
        id: x.id,
        score: x.score,
        feedback: x.feedback.slice(0, 500),
      })),
      proposedSystem: (systemPreview || '').slice(0, 2000),
    };

    // Accept child → score on Pareto set
    if (iterPayload.accepted) {
      const newCandidateIndex = P.length;
      P.push(child);
      state.Psystems.push(serializeCandidate(child));
      const row = await scoreParetoRow(child);
      S.push(row);
      state.S = S;
      state.bestIdx = argmax(S.map((r) => avg(r)));

      // Update lineage tracking
      if (operationType === 'mutation') {
        // For mutation, track which module was changed
        const moduleIndex = state.moduleIndex ?? 0;
        const moduleCount = state.moduleCount ?? getModuleCount(parent);
        const actualModuleIndex =
          (moduleIndex - 1 + moduleCount) % moduleCount; // Get the module that was actually mutated

        state.lineage.push({
          candidateIndex: newCandidateIndex,
          changedModules: [actualModuleIndex],
          parentIndex: k,
        });
      } else if (operationType === 'crossover' && secondParentIndex !== undefined) {
        // For crossover, track modules from both parents
        const lineageA =
          state.lineage.find((l) => l.candidateIndex === k)
            ?.changedModules ?? [];
        const lineageB =
          state.lineage.find((l) => l.candidateIndex === secondParentIndex)
            ?.changedModules ?? [];
        const mergedModules = [...new Set([...lineageA, ...lineageB])]; // Union of changed modules

        state.lineage.push({
          candidateIndex: newCandidateIndex,
          changedModules: mergedModules,
          parentIndex: k, // Primary parent
        });
      }

      logger.step(
        'Accepted',
        `k=${newCandidateIndex} bestIdx=${state.bestIdx} operation=${operationType}`
      );
    } else {
      logger.warn('Rejected');
    }

    if (persist?.onCheckpoint) {
      await persist.onCheckpoint(state, iterPayload);
      logger.debug('Checkpoint saved');
    }
    state.bandit = bandit.serialize();
    state.budgetLeft = budgetTracker.remaining();

    iterationsRun++;
  }
  return iterationsRun;
}
