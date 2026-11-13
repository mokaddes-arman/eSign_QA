/**
 * Tiny dependency-free logger with levels and timestamps.
 * Set LOG_LEVEL=debug|info|warn|error to control verbosity.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const configured = (process.env.LOG_LEVEL as Level) || 'info';

function log(level: Level, scope: string, message: string, meta?: unknown) {
  if (ORDER[level] < ORDER[configured]) return;
  const time = new Date().toISOString().slice(11, 19);
  const line = `[${time}] ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`;
  if (level === 'error') console.error(line, meta ?? '');
  else if (level === 'warn') console.warn(line, meta ?? '');
  else console.log(line, meta ?? '');
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: unknown) => log('debug', scope, message, meta),
    info: (message: string, meta?: unknown) => log('info', scope, message, meta),
    warn: (message: string, meta?: unknown) => log('warn', scope, message, meta),
    error: (message: string, meta?: unknown) => log('error', scope, message, meta),
  };
}

export const logger = createLogger('esignpro');
