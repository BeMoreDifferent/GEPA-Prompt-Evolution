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
  /** Adaptive strategy scheduling options */
  strategySchedule?: StrategyScheduleOptions;
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

/**
 * Controls how frequently we explore strategies vs exploit the bandit, and how often
 * we perform pure GEPA reflection without any strategy hint. The explore probability
 * scales up when recent uplifts are small.
 */
export interface StrategyScheduleOptions {
  /** Window size for recent uplifts moving average */
  windowSize?: number;            // default 8
  /** If avg uplift within window is below this, boost exploration */
  slowdownThreshold?: number;     // default 0.01
  /** Base exploration probability when improving well */
  baseExploreProb?: number;       // default 0.1
  /** Max exploration probability when stagnating */
  maxExploreProb?: number;        // default 0.6
  /** Probability to drop hints entirely (pure reflection) under normal conditions */
  baseNoHintProb?: number;        // default 0.15
  /** Max probability to drop hints entirely when stagnating */
  maxNoHintProb?: number;         // default 0.4
  /** Number of core strategies to consider for exploration when JSON lacks explicit "core" */
  defaultCoreTopK?: number;       // default 6
  /** Minimum applicability score to keep a strategy after LLM prefilter */
  prefilterThreshold?: number;    // default 0.3
  /** Max number of strategies to keep after prefilter (0 = keep all) */
  prefilterTopK?: number;         // default 10
  /** Cooldown in iterations before re-running prefilter when stagnating */
  reprefilterCooldownIters?: number; // default 6
}


