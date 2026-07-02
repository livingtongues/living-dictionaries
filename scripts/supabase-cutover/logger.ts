import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'

/**
 * Migration run logger. Bypasses `record-logs.ts`'s console hijack (which
 * redirects `console.info` to a file ONLY — the historical "migrate output is
 * truncated" mystery) by writing straight to stdout, and mirrors every line
 * into a run log file next to the data dir so long runs are reviewable.
 */
export function create_logger(log_path?: string) {
  if (log_path)
    mkdirSync(dirname(log_path), { recursive: true })
  return (message: string) => {
    const line = `[${new Date().toISOString()}] ${message}`
    process.stdout.write(`${line}\n`)
    if (log_path) {
      try {
        appendFileSync(log_path, `${line}\n`)
      } catch { /* log file is best-effort */ }
    }
  }
}

export type Logger = ReturnType<typeof create_logger>
