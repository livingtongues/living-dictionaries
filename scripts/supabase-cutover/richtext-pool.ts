import type { ChildProcess } from 'node:child_process'
import type { Row } from './mappers'
import type { ConversionStats } from './conversion-stats'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import process from 'node:process'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

/**
 * Isolated rich-text conversion. Tiptap/ProseMirror leak ~0.3–0.75MB of
 * GC-proof heap per `html_to_markdown` call (measured under happy-dom AND
 * jsdom, 2026-07-02) — a notes-heavy dictionary can exceed ANY heap in a
 * single dict, so in-process budgets aren't enough. Conversions run in a
 * disposable child (richtext-child.ts) that is KILLED and respawned once its
 * budget (count or bytes) is spent; the parent's heap stays flat.
 *
 * Requests are serialized (one in flight) — conversion is CPU-bound in the
 * child anyway, and ordering keeps the protocol trivial.
 */

const here = dirname(fileURLToPath(import.meta.url))
const TSX_CLI = join(here, '../node_modules/tsx/dist/cli.mjs')
const CHILD_SCRIPT = join(here, 'richtext-child.ts')

const RECYCLE_CONVERSIONS = 1000
const RECYCLE_BYTES = 3_000_000

/**
 * JSON.stringify legally leaves U+2028/U+2029 unescaped, but readline treats
 * them as line breaks → the peer receives a truncated JSON line and dies
 * (bit us: boienen-old-buhi-langua.grammar, 9× U+2028). Escape for NDJSON.
 */
export function to_ndjson_line(value: unknown): string {
  return `${JSON.stringify(value).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')}\n`
}

interface ChildResponse {
  id: number
  result: unknown
  error?: string
  stats: { converted: number, passed_through: number, emptied: number }
  mismatches: ConversionStats['mismatches']
}

let child: ChildProcess | null = null
let child_reader: readline.Interface | null = null
let child_conversions = 0
let child_bytes = 0
let next_id = 1
let queue: Promise<unknown> = Promise.resolve()

function spawn_child(): ChildProcess {
  const spawned = spawn(process.execPath, [TSX_CLI, CHILD_SCRIPT], {
    cwd: join(here, '..'),
    stdio: ['pipe', 'pipe', 'inherit'],
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=3072' },
  })
  child_reader = readline.createInterface({ input: spawned.stdout!, terminal: false })
  child_conversions = 0
  child_bytes = 0
  return spawned
}

function recycle_child_if_spent() {
  if (child && (child_conversions >= RECYCLE_CONVERSIONS || child_bytes >= RECYCLE_BYTES)) {
    child.stdin!.end()
    child.kill()
    child = null
    child_reader = null
  }
}

async function request_raw(payload: { kind: 'value' | 'multistring', value: unknown, where: string }): Promise<ChildResponse> {
  recycle_child_if_spent()
  if (!child)
    child = spawn_child()
  const id = next_id++
  const active_child = child
  const reader = child_reader!

  return await new Promise<ChildResponse>((resolve, reject) => {
    const on_line = (line: string) => {
      let parsed: ChildResponse
      try {
        parsed = JSON.parse(line)
      } catch {
        return // stray output
      }
      if (parsed.id !== id)
        return
      cleanup()
      resolve(parsed)
    }
    const on_exit = (code: number | null) => {
      cleanup()
      reject(new Error(`richtext child exited (${code}) mid-request`))
    }
    const cleanup = () => {
      reader.off('line', on_line)
      active_child.off('exit', on_exit)
    }
    reader.on('line', on_line)
    active_child.on('exit', on_exit)
    active_child.stdin!.write(to_ndjson_line({ id, ...payload }))
  })
}

/**
 * Convert with one retry in a FRESH child (covers a child dying mid-request).
 * A value that fails twice passes through unconverted (the read-time html-era
 * shim still renders it) and is recorded as a mismatch for eyeballing.
 */
async function convert_isolated({ kind, value, where, stats }: {
  kind: 'value' | 'multistring'
  value: unknown
  where: string
  stats: ConversionStats
}): Promise<unknown> {
  const size = approximate_size(value)
  const run = () => request_raw({ kind, value, where })
  let response: ChildResponse
  try {
    response = await run()
  } catch {
    child?.kill()
    child = null
    try {
      response = await run()
    } catch (second_failure) {
      // Twice-fatal value (e.g. single value bigger than the child heap):
      // pass through unconverted — the read-time html-era shim still renders
      // it — and flag loudly for eyeballing.
      child?.kill()
      child = null
      stats.mismatches.push({ where, original_html: `CONVERSION CRASHED TWICE: ${(second_failure as Error).message}`, markdown: '', original_text: '', roundtrip_text: '' })
      return value
    }
  }
  child_conversions += response.stats.converted
  child_bytes += response.stats.converted ? size : 0

  if (response.error) {
    stats.mismatches.push({ where, original_html: `CONVERSION ERROR: ${response.error}`, markdown: '', original_text: '', roundtrip_text: '' })
    return value // pass through — html-era shim renders it
  }
  stats.converted += response.stats.converted
  stats.passed_through += response.stats.passed_through
  stats.emptied += response.stats.emptied
  stats.mismatches.push(...response.mismatches)
  return response.result
}

function approximate_size(value: unknown): number {
  if (typeof value === 'string')
    return value.length
  if (value && typeof value === 'object')
    return Object.values(value as Row).reduce((sum: number, entry) => sum + String(entry ?? '').length, 0)
  return 0
}

/** Serialized public API (mirrors richtext.ts's sync functions). */
export function convert_value_isolated(options: { value: unknown, where: string, stats: ConversionStats }): Promise<string | null> {
  const next = queue.then((): Promise<string | null> => convert_isolated({ kind: 'value', ...options }) as Promise<string | null>)
  queue = next.catch((): null => null)
  return next
}

export function convert_multistring_isolated(options: { value: unknown, where: string, stats: ConversionStats }): Promise<Row | null> {
  const next = queue.then((): Promise<Row | null> => convert_isolated({ kind: 'multistring', ...options }) as Promise<Row | null>)
  queue = next.catch((): null => null)
  return next
}

export function shutdown_conversion_pool() {
  if (child) {
    child.stdin!.end()
    child.kill()
    child = null
    child_reader = null
  }
}
