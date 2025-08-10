import type { LLM } from './types.js';
import { clampNumber, objectOfNumberKeys, safeParseWithSchema } from './json.js';

export interface StrategyDefLite { id: string; hint: string; core?: boolean }

export interface PrefilterResult {
  kept: StrategyDefLite[];
  scores: Record<string, number>;
  raw: string;
}

/**
 * Ask the LLM to rate each strategy's applicability to the task corpus.
 * Returns strategies filtered by threshold and optional topK.
 */
export async function prefilterStrategies(
  llm: LLM,
  strategies: StrategyDefLite[],
  taskPreview: string[],
  opts: { threshold: number; topK?: number }
): Promise<PrefilterResult> {
  if (strategies.length === 0) return { kept: [], scores: {}, raw: '' };
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
  const scores: Record<string, number> = {};
  for (const id of ids) scores[id] = clampNumber(parsed[id], 0, 1, 0);

  const filtered = strategies
    .map(s => ({ s, score: scores[s.id] ?? 0 }))
    .filter(x => x.score >= opts.threshold)
    .sort((a, b) => b.score - a.score);
  const topK = opts.topK && opts.topK > 0 ? filtered.slice(0, opts.topK) : filtered;
  return { kept: topK.map(x => x.s), scores, raw };
}


