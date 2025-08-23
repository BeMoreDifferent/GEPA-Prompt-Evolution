import type { LLM } from './types.js';
import { clampNumber, objectOfNumberKeys, safeParseWithSchema } from './json.js';
import type { StrategyLog } from './globalStrategyLog.js';

export interface StrategyDefLite { id: string; hint: string; core?: boolean }

export interface PrefilterResult {
  kept: StrategyDefLite[];
  scores: Record<string, number>;
  raw: string;
}

/**
 * Ask the LLM to rate each strategy's applicability to the task corpus,
 * then combine with historical performance from the global log.
 * Returns strategies filtered by a combined score, threshold, and optional topK.
 */
export async function prefilterStrategies(
  llm: LLM,
  strategies: StrategyDefLite[],
  taskPreview: string[],
  opts: {
    threshold: number;
    topK?: number;
    log?: StrategyLog;
    logWeight?: number;
  }
): Promise<PrefilterResult> {
  if (strategies.length === 0) return { kept: [], scores: {}, raw: '' };
  const { threshold, topK, log = {}, logWeight = 0.5 } = opts;

  const ids = strategies.map(s => s.id);
  const prompt = [
    'You are rating strategy hints for applicability to the following representative tasks.',
    'Return STRICT JSON: a map from strategy id to a number in [0,1] where higher means more applicable.',
    'Unknowns should be 0. Base strictly on the provided tasks. No extra keys. No prose.',
    '',
    'Tasks preview:',
    ...taskPreview.slice(0, 8).map((t, i) => `${i + 1}. ${t.slice(0, 280)}`),
    '',
    'Strategies:',
    ...strategies.map(s => `- ${s.id}: ${s.hint.slice(0, 240)}`),
    '',
    'Output JSON only.'
  ].join('\n');

  const raw = await llm.complete(prompt);
  const schema = objectOfNumberKeys(ids);
  const parsed = safeParseWithSchema(raw, schema);
  const llmScores: Record<string, number> = {};
  for (const id of ids) llmScores[id] = clampNumber(parsed[id], 0, 1, 0);

  const combinedScores: Record<string, number> = {};
  const finalScores = strategies.map(s => {
    const llmScore = llmScores[s.id] ?? 0;
    const logEntry = log[s.id];

    // If strategy is in the log, calculate its historical average reward. Otherwise, neutral.
    const historicalScore = logEntry && logEntry.runs > 0
      ? logEntry.totalReward / logEntry.runs
      : 0.5; // Neutral score for strategies not in the log

    // Weighted average of LLM score and historical score
    const combinedScore = (1 - logWeight) * llmScore + logWeight * historicalScore;
    combinedScores[s.id] = combinedScore;

    return { s, score: combinedScore };
  });

  const filtered = finalScores
    .filter(x => x.score >= threshold)
    .sort((a, b) => b.score - a.score);

  const topKFiltered = topK && topK > 0 ? filtered.slice(0, topK) : filtered;

  return { kept: topKFiltered.map(x => x.s), scores: combinedScores, raw };
}


