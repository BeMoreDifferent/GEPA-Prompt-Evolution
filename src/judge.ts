import type { ChatLLM, TaskItem } from './types.js';
import { clampNumber, safeParseWithSchema, type CompletionSchema } from './json.js';

export function buildJudgePrompt(rubric: string): string {
  return [
    'You are a strict evaluator. Return ONLY JSON: {"score":0.00,"feedback":"..."}',
    'Score in [0,1] with two decimals. Keep feedback brief.',
    'Rubric:', rubric
  ].join('\n');
}

/** Call the judge LLM to evaluate system+user+assistant => {score, feedback} */
export async function judgeScore(
  chatLLM: ChatLLM,
  rubric: string,
  system: string,
  user: string,
  assistant: string
): Promise<{ score: number; feedback: string }> {
  const sys = buildJudgePrompt(rubric);
  const content = await chatLLM.chat([
    { role: 'system', content: sys },
    { role: 'user', content: `System:\n${system}\n\nUser:\n${user}\n\nAssistant:\n${assistant}` }
  ]);

  // Structured parse with clamping and defaults
  const schema: CompletionSchema<{ score: number; feedback: string }> = {
    parse(input: unknown) {
      const o = (typeof input === 'object' && input) ? (input as Record<string, unknown>) : {};
      const score = clampNumber(o.score, 0, 1, 0);
      const feedback = typeof o.feedback === 'string' ? o.feedback : '';
      return { score, feedback };
    }
  };
  const parsed = safeParseWithSchema(content, schema);
  return parsed;
}


