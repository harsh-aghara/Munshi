/**
 * Structured JSON logging (BE-4).
 * Logs never contain transcript, document text, drafts, custom briefs, addresses, or audio.
 */

interface LogEntry {
  level: 'info' | 'warn' | 'error';
  requestId?: string;
  route?: string;
  latencyMs?: number;
  status?: number;
  message: string;
  error?: string;
}

function emit(entry: LogEntry) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...entry,
  });
  if (entry.level === 'error') {
    console.error(line);
  } else if (entry.level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const log = {
  info(message: string, meta?: Omit<LogEntry, 'level' | 'message'>) {
    emit({ level: 'info', message, ...meta });
  },
  warn(message: string, meta?: Omit<LogEntry, 'level' | 'message'>) {
    emit({ level: 'warn', message, ...meta });
  },
  error(message: string, meta?: Omit<LogEntry, 'level' | 'message'>) {
    emit({ level: 'error', message, ...meta });
  },
};
