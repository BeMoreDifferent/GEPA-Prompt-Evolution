import type { LLM, Module } from './types.js';
import { isModular, getModule, setModule, getModuleCount } from './modules.js';

export interface JudgedExample {
  user: string;
  output: string;
  feedback: string;
  /** Optional execution trace summary */
  execTrace?: string;
  /** Optional evaluator trace summary */
  evalTrace?: string;
}

/**
 * Summarizes trace data into a bounded, deterministic string format
 * @param traces - Raw trace data from execution or evaluation
 * @param maxSize - Maximum size in characters for the summary
 * @returns Summarized trace string or undefined if no traces
 */
export function summarizeTraces(traces: Record<string, unknown> | null | undefined, maxSize: number = 1000): string | undefined {
  if (!traces || typeof traces !== 'object') {
    return undefined;
  }

  try {
    // Convert to stable JSON with sorted keys for determinism
    const sortedKeys = Object.keys(traces).sort();
    const sortedTraces: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      sortedTraces[key] = traces[key];
    }
    
    const jsonStr = JSON.stringify(sortedTraces, null, 2);
    
    // Truncate if too long, preserving JSON structure
    if (jsonStr.length <= maxSize) {
      return jsonStr;
    }
    
    // Truncate and add ellipsis, trying to preserve complete key-value pairs
    const truncated = jsonStr.slice(0, maxSize - 3);
    const lastComma = truncated.lastIndexOf(',');
    const lastBrace = truncated.lastIndexOf('}');
    const lastNewline = truncated.lastIndexOf('\n');
    
    // Find the best truncation point
    let truncateAt = Math.max(lastComma, lastBrace, lastNewline);
    if (truncateAt === -1 || truncateAt < maxSize * 0.8) {
      truncateAt = maxSize - 3;
    }
    
    return truncated.slice(0, truncateAt) + '...';
  } catch (error) {
    // Fallback to string representation if JSON fails
    const str = String(traces);
    return str.length <= maxSize ? str : str.slice(0, maxSize - 3) + '...';
  }
}

/** Build the meta-prompt that asks the LLM to rewrite the system prompt */
export function buildReflectionPrompt(system: string, examples: JudgedExample[], strategyHint = ''): string {
  const ex = examples.map((e, i) => {
    const parts = [`#${i + 1} USER:`, e.user, `ASSISTANT:`, e.output, `FEEDBACK:`, e.feedback];
    
    // Add traces section if present
    const traces: string[] = [];
    if (e.execTrace) traces.push(`EXECUTION TRACE: ${e.execTrace}`);
    if (e.evalTrace) traces.push(`EVALUATOR TRACE: ${e.evalTrace}`);
    
    if (traces.length > 0) {
      parts.push(`TRACES:`, ...traces);
    }
    
    return parts.join('\n');
  }).join('\n\n');

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

/** Build the meta-prompt that asks the LLM to rewrite a specific module */
export function buildModuleReflectionPrompt(
  module: Module,
  allModules: Module[],
  moduleIndex: number,
  examples: JudgedExample[],
  strategyHint = ''
): string {
  const ex = examples.map((e, i) => {
    const parts = [`#${i + 1} USER:`, e.user, `ASSISTANT:`, e.output, `FEEDBACK:`, e.feedback];
    
    // Add traces section if present
    const traces: string[] = [];
    if (e.execTrace) traces.push(`EXECUTION TRACE: ${e.execTrace}`);
    if (e.evalTrace) traces.push(`EVALUATOR TRACE: ${e.evalTrace}`);
    
    if (traces.length > 0) {
      parts.push(`TRACES:`, ...traces);
    }
    
    return parts.join('\n');
  }).join('\n\n');

  const moduleContext = allModules.map((m, i) => 
    `${i === moduleIndex ? '>>> ' : ''}Module ${i + 1} (${m.id}): ${i === moduleIndex ? 'CURRENT MODULE TO UPDATE' : 'PRESERVE AS-IS'}`
  ).join('\n');

  return [
    'You will REWRITE a specific module in a multi-module system.',
    strategyHint ? `Strategy hint: ${strategyHint}` : '',
    'System context (all modules):',
    moduleContext,
    '',
    `Current module ${moduleIndex + 1} (${module.id}):`, "'''", module.prompt, "'''",
    '',
    'Below are examples and strict-judge feedback.',
    ex,
    `Write a NEW prompt for module ${moduleIndex + 1} (${module.id}) that: fixes failures; preserves what worked; is concise, safe, and actionable; and stays domain-agnostic.`,
    'Return only the new module prompt between triple quotes.',
    "'''[new module prompt]'''"
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

/** Ask the LLM to propose an improved module prompt */
export async function proposeNewModule(
  llm: LLM,
  candidate: { system?: string; modules?: Module[] },
  moduleIndex: number,
  examples: JudgedExample[],
  strategyHint?: string
): Promise<{ system?: string; modules?: Module[] }> {
  if (!isModular(candidate) && !candidate.system) {
    throw new Error('Candidate must have either system or modules');
  }

  if (isModular(candidate)) {
    const module = getModule(candidate, moduleIndex);
    if (!module) {
      throw new Error(`Module at index ${moduleIndex} not found`);
    }

    const raw = await llm.complete(buildModuleReflectionPrompt(module, candidate.modules, moduleIndex, examples, strategyHint ?? ''));
    // Accept both triple single or double quotes, and optional [new module prompt] tag
    const m = raw.match(/(['"])['\"]{2}([\s\S]*?)\1{2}|'''([\s\S]*?)'''|"""([\s\S]*?)"""/);
    const body = (m?.[2] ?? m?.[3] ?? m?.[4] ?? raw).trim();
    const newPrompt = body.replace(/^\[new module prompt\]\s*/i, '').trim();

    const newModule: Module = { id: module.id, prompt: newPrompt };
    return setModule(candidate, moduleIndex, newModule);
  } else {
    // Single system case - treat as module 0
    const raw = await llm.complete(buildReflectionPrompt(candidate.system!, examples, strategyHint ?? ''));
    const m = raw.match(/(['"])['\"]{2}([\s\S]*?)\1{2}|'''([\s\S]*?)'''|"""([\s\S]*?)"""/);
    const body = (m?.[2] ?? m?.[3] ?? m?.[4] ?? raw).trim();
    const newSystem = body.replace(/^\[new system prompt\]\s*/i, '').trim();
    return { system: newSystem };
  }
}


