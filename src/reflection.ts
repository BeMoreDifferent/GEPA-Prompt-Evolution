import type { LLM } from './types.js';

export interface JudgedExample {
  user: string;
  output: string;
  feedback: string;
}

/** Build the meta-prompt that asks the LLM to rewrite the system prompt */
export function buildReflectionPrompt(system: string, examples: JudgedExample[], strategyHint = ''): string {
  const ex = examples.map((e, i) =>
    [`#${i + 1} USER:`, e.user, `ASSISTANT:`, e.output, `FEEDBACK:`, e.feedback].join('\n')
  ).join('\n\n');

  return [
    'You will REWRITE the system prompt for an assistant.',
    strategyHint ? `Strategy hint: ${strategyHint}` : '',
    'Current system prompt:', "'''", system, "'''",
    'Below are examples and strict-judge feedback.',
    ex,
    'Write a NEW system prompt that: fixes failures; preserves what worked; is concise, safe, and actionable; and stays domain-agnostic.',
    'Return only the new system prompt between triple quotes.',
    "'''[new system prompt]'''"
  ].filter(Boolean).join('\n');
}

/** Ask the LLM to propose an improved system prompt */
export async function proposeNewSystem(
  llm: LLM,
  system: string,
  examples: JudgedExample[],
  strategyHint?: string
): Promise<string> {
  const raw = await llm.complete(buildReflectionPrompt(system, examples, strategyHint ?? ''));
  // Accept both triple single or double quotes, and optional [new system prompt] tag
  const m = raw.match(/(['"])['\"]{2}([\s\S]*?)\1{2}|'''([\s\S]*?)'''|"""([\s\S]*?)"""/);
  const body = (m?.[2] ?? m?.[3] ?? m?.[4] ?? raw).trim();
  return body.replace(/^\[new system prompt\]\s*/i, '').trim();
}


