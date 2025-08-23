import type {
  Candidate,
  TaskItem,
  GepaOptions,
  GEPAState,
  RunPersist,
} from '../types.js';
import type { Logger } from '../logger.js';
import type { BudgetTracker } from '../budget.js';
import {
  getModuleCount,
  serializeCandidate,
  deserializeCandidate,
} from '../modules.js';

/**
 * Initializes the GEPA state, including data splitting and initial Pareto scoring.
 */
export async function initializeState(
  seed: Candidate,
  dtrain: TaskItem[],
  opts: GepaOptions,
  persist: RunPersist | undefined,
  logger: Logger,
  budgetTracker: BudgetTracker
): Promise<{
  state: GEPAState;
  P: Candidate[];
  S: number[][];
  Dpareto: TaskItem[];
  Dhold: TaskItem[];
  Dfb: TaskItem[];
  scoreParetoRow: (cand: Candidate) => Promise<number[]>;
}> {
  const {
    execute,
    mu,
    muf,
    paretoSize: nPareto,
    holdoutSize = 0,
    scoreForPareto = 'muf',
    mufCosts = true,
  } = opts;

  // ---- resume or fresh ----
  let state: GEPAState = persist?.state ?? {
    version: 2,
    budgetLeft: opts.budget,
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
    moduleCount: getModuleCount(seed),
  };

  // Split once, then store indices for determinism across resumes
  if (state.DparetoIdx.length === 0 && state.DfbIdx.length === 0) {
    const idx = [...dtrain.keys()];
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }

    // Ensure valid split with at least one feedback item
    const total = idx.length;
    const paretoEff = Math.min(
      nPareto,
      Math.max(1, total > 1 ? total - 1 : total)
    );
    const holdMax = Math.max(0, total - paretoEff - 1);
    const holdEff = Math.min(holdoutSize, holdMax);

    // Ensure we have at least one feedback item
    if (total - paretoEff - holdEff < 1) {
      logger.warn(
        `Adjusting split: feedback set would be empty. Reducing pareto from ${paretoEff} to ${Math.max(
          1,
          total - holdEff - 1
        )}`
      );
      const adjustedPareto = Math.max(1, total - holdEff - 1);
      state.DparetoIdx = idx.slice(0, adjustedPareto);
      state.DholdIdx = idx.slice(adjustedPareto, adjustedPareto + holdEff);
      state.DfbIdx = idx.slice(adjustedPareto + holdEff);
    } else {
      state.DparetoIdx = idx.slice(0, paretoEff);
      state.DholdIdx = idx.slice(paretoEff, paretoEff + holdEff);
      state.DfbIdx = idx.slice(paretoEff + holdEff);
    }

    state.budgetLeft = state.budgetLeft || opts.budget;
  }

  const Dpareto = state.DparetoIdx.map((i) => dtrain[i]);
  const Dhold = state.DholdIdx.map((i) => dtrain[i]);
  let Dfb = state.DfbIdx.map((i) => dtrain[i]);

  logger.info(
    `Split: pareto=${Dpareto.length}, holdout=${Dhold.length}, feedback=${Dfb.length}`
  );

  if (Dfb.length === 0 && Dpareto.length > 0) {
    // Fallback: reuse Pareto items as feedback for tiny datasets
    Dfb = [...Dpareto];
    logger.warn(
      'Feedback set empty; falling back to use Pareto items for minibatches'
    );
  }

  // Rebuild P and S
  const P: Candidate[] = state.Psystems.map((s) => deserializeCandidate(s));
  const S: number[][] = state.S.length ? state.S : (state.S = []);

  // Helper to compute a Pareto row using configured scorer
  const scoreParetoRow = async (cand: Candidate): Promise<number[]> => {
    const row: number[] = [];
    logger.debug(
      `Starting Pareto evaluation with budget: ${budgetTracker.remaining()}`
    );
    for (const item of Dpareto) {
      if (!budgetTracker.canAfford(1)) {
        logger.debug(
          `Cannot afford Pareto evaluation, budget: ${budgetTracker.remaining()}`
        );
        break;
      }
      const { output, traces } = await execute({ candidate: cand, item });
      budgetTracker.dec(1, 'pareto:execute');
      if (scoreForPareto === 'mu') {
        row.push(mu(output, item.meta ?? null));
      } else {
        if (mufCosts && !budgetTracker.canAfford(1)) {
          logger.debug(
            `Cannot afford Pareto judge, budget: ${budgetTracker.remaining()}`
          );
          break;
        }
        const f = await muf({ item, output, traces: traces ?? null });
        if (mufCosts) budgetTracker.dec(1, 'pareto:muf');
        row.push(f.score);
      }
    }
    logger.debug(
      `Pareto evaluation complete, budget remaining: ${budgetTracker.remaining()}`
    );
    return row;
  };

  // Seed Pareto row for initial candidate if missing
  if (S.length === 0) {
    logger.step('Init Pareto row', `k=0 over ${Dpareto.length} items`);
    const row = await scoreParetoRow(P[0]);
    S.push(row);
    // Update state budget after Pareto evaluation
    state.budgetLeft = budgetTracker.remaining();
  }

  return { state, P, S, Dpareto, Dhold, Dfb, scoreParetoRow };
}
