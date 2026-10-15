// Small leveled logger for the server. LOG_LEVEL=debug|info|warn|error (default info).
// One line per entry with a timestamp and level, so the output can be grepped or shipped
// to a log collector. The CLI helpers under scripts/ print directly on purpose.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

function fmt(v) {
  if (v instanceof Error) return v.stack || v.message;
  if (v !== null && typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

function emit(level, args) {
  if (LEVELS[level] < threshold) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${args.map(fmt).join(' ')}`;
  (LEVELS[level] >= LEVELS.warn ? process.stderr : process.stdout).write(line + '\n');
}

module.exports = {
  debug: (...args) => emit('debug', args),
  info: (...args) => emit('info', args),
  warn: (...args) => emit('warn', args),
  error: (...args) => emit('error', args),
};
