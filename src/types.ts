/* Strict domain types for the optimizer */

export interface Candidate {
  /** Current system prompt under evaluation */
  system: string;
}

export interface TaskItem {
  /** Stable identifier for logging and reproducibility */
  id: string;
  /** User prompt text */
  user: string;
  /** Optional metadata for metrics/safety topics, etc. */
  meta?: Record<string, unknown> | null;
}

export interface ExecuteResult {
  /** Raw assistant output text produced under the candidate.system */
  output: string;
  /** Optional trace info (tool logs, timing, etc.) */
  traces?: Record<string, unknown> | null;
}

/** Function that runs the LLM (actor) with a candidate.system against an item */
export type SystemExecute = (args: {
  candidate: Candidate;
  item: TaskItem;
}) => Promise<ExecuteResult>;

/** Numeric metric on [0,1] (for Pareto set or ground-truthable tasks) */
export type MetricMu = (y: string, m: unknown) => number;

/** Judge score + textual feedback derived from the output */
export type FeedbackMuF = (args: {
  item: TaskItem;
  output: string;
  traces?: Record<string, unknown> | null;
}) => Promise<{ score: number; feedbackText: string }> | { score: number; feedbackText: string };

/** Minimal single-turn LLM for reflection/updating the system prompt */
export interface LLM {
  complete(prompt: string): Promise<string>;
}

/** Multi-message chat LLM (used by judge) */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
export interface ChatLLM {
  chat(messages: ChatMessage[], opts?: { temperature?: number; maxTokens?: number }): Promise<string>;
}

/** Core configuration */
export interface GepaOptions {
  execute: SystemExecute;
  mu: MetricMu;
  muf: FeedbackMuF;
  llm: LLM;

  budget: number;
  minibatchSize: number;
  paretoSize: number;

  holdoutSize?: number;         // default 0
  epsilonHoldout?: number;      // default 0.02
  strategiesPath?: string;      // default "strategies/strategies.json"
}

/** Serializable bandit state */
export interface Ucb1State {
  t: number;
  stats: Array<{ id: string; n: number; mean: number }>;
}

/** Serializable optimizer state for resume */
export interface GEPAState {
  version: 2;
  budgetLeft: number;
  iter: number;
  Psystems: string[];     // candidates pool (system prompts)
  S: number[][];          // Pareto scores: S[k][i]
  DparetoIdx: number[];
  DfbIdx: number[];
  DholdIdx: number[];
  bestIdx: number;
  seeded: boolean;
  bandit: Ucb1State | null;
}


