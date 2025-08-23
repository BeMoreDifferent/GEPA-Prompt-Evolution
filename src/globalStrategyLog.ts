import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/** Path to the global strategy log file */
const LOG_PATH = path.join(os.homedir(), '.gepa', 'strategy_log.json');

export interface StrategyLogEntry {
  id: string;
  runs: number;
  totalReward: number;
}

export type StrategyLog = Record<string, StrategyLogEntry>;

/**
 * Loads the global strategy log from disk.
 * Returns an empty log if the file doesn't exist or is invalid.
 */
export async function loadStrategyLog(): Promise<StrategyLog> {
  try {
    await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
    const raw = await fs.readFile(LOG_PATH, 'utf8');
    return JSON.parse(raw) as StrategyLog;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return {}; // File doesn't exist, return empty log
    }
    console.warn(`Could not load global strategy log: ${(e as Error).message}`);
    return {};
  }
}

/**
 * Saves the global strategy log to disk.
 */
export async function saveStrategyLog(log: StrategyLog): Promise<void> {
  try {
    await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
    await fs.writeFile(LOG_PATH, JSON.stringify(log, null, 2));
  } catch (e) {
    console.warn(`Could not save global strategy log: ${(e as Error).message}`);
  }
}

/**
 * Updates the global strategy log with data from a completed run.
 * @param existingLog - The current global strategy log.
 * @param runStats - Statistics from the UCB1 bandit at the end of a run.
 * @returns The updated strategy log.
 */
export function updateStrategyLog(
  existingLog: StrategyLog,
  runStats: Array<{ id: string; n: number; mean: number }>
): StrategyLog {
  const updatedLog = { ...existingLog };

  for (const stat of runStats) {
    if (stat.n === 0) continue; // Skip strategies that were not used

    const existing = updatedLog[stat.id] ?? { id: stat.id, runs: 0, totalReward: 0 };

    // We can't just average the means, so we work with totals
    const runTotalReward = stat.mean * stat.n;

    updatedLog[stat.id] = {
      id: stat.id,
      runs: existing.runs + stat.n,
      totalReward: existing.totalReward + runTotalReward,
    };
  }

  return updatedLog;
}
