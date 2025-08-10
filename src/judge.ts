import type { ChatLLM, TaskItem } from './types.js';

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

  try {
    const j = JSON.parse(content.trim()) as { score?: unknown; feedback?: unknown };
    const s = Math.max(0, Math.min(1, Number(j.score)));
    return { score: Number.isFinite(s) ? s : 0, feedback: String(j.feedback ?? '') };
  } catch {
    return { score: 0, feedback: 'Non-JSON judge output' };
  }
}


