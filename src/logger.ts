/**
 * Simple colored logger with high-level step logging.
 * No external deps; ANSI colors via constants only.
 */

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

/** ANSI color constants (do not hardcode colors elsewhere). */
export const COLORS = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  bold: '\u001b[1m',
  gray: '\u001b[90m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  magenta: '\u001b[35m',
  cyan: '\u001b[36m',
  white: '\u001b[37m'
} as const;

export interface Logger {
  enabled: boolean;
  level: LogLevel;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
  /** Step update for visual progress (high signal). */
  step(title: string, detail?: string): void;
}

function shouldLog(level: LogLevel, desired: LogLevel): boolean {
  const order: Record<Exclude<LogLevel, 'silent'>, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  };
  if (desired === 'silent') return false;
  if (level === 'silent') return false;
  return order[level as Exclude<LogLevel, 'silent'>] <= order[desired as Exclude<LogLevel, 'silent'>];
}

export function createLogger(enabled: boolean, level: LogLevel = 'info'): Logger {
  const fmt = (color: string, label: string, msg: string): string => {
    return `${COLORS.dim}${new Date().toISOString()}${COLORS.reset} ${color}${label}${COLORS.reset} ${msg}`;
  };

  const logImpl = (target: 'log' | 'warn' | 'error', color: string, label: string, msg: string): void => {
    if (!enabled) return;
    // eslint-disable-next-line no-console
    console[target](fmt(color, label, msg));
  };

  return {
    enabled,
    level,
    info(message: string): void {
      if (shouldLog('info', level)) logImpl('log', COLORS.cyan, '[info]', message);
    },
    warn(message: string): void {
      if (shouldLog('warn', level)) logImpl('warn', COLORS.yellow, '[warn]', message);
    },
    error(message: string): void {
      if (shouldLog('error', level)) logImpl('error', COLORS.red, '[error]', message);
    },
    debug(message: string): void {
      if (shouldLog('debug', level)) logImpl('log', COLORS.gray, '[debug]', message);
    },
    step(title: string, detail?: string): void {
      if (!enabled) return;
      const t = `${COLORS.magenta}${COLORS.bold}${title}${COLORS.reset}`;
      const d = detail ? `${COLORS.gray}${detail}${COLORS.reset}` : '';
      // eslint-disable-next-line no-console
      console.log(`${t} ${d}`.trim());
    }
  };
}

/** A no-op logger you can use as default. */
export const silentLogger: Logger = createLogger(false, 'silent');


