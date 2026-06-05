import type { ClientLogPayload } from '$lib/server/insert-client-log'
import { version } from '$app/environment'
import { api_log, send_log_beacon } from '$api/log/_call'

/**
 * Client-side error capture + remote-log shipper. Initialized once from
 * `+layout.svelte` `onMount` on app boot.
 *
 * Captures four channels:
 *  1. `window.error`                  — uncaught synchronous errors
 *  2. `window.unhandledrejection`     — uncaught rejected promises
 *  3. `console.error`                 — explicit error logging in app code
 *  4. `log_event(...)`                — explicit calls (info / warn / crash)
 *
 * Buffers in localStorage (so an offline client doesn't lose logs),
 * flushes every FLUSH_INTERVAL_MS, and on `pagehide` / `visibilitychange:hidden`
 * flushes via `navigator.sendBeacon` so the request survives page teardown
 * (catches the iOS WKWebView "white flash" crashes that wipe the screen
 * before a normal fetch could land).
 *
 * NEVER throws. Logging-of-logging is a recursion trap, so `console.error` is
 * patched with a flag to short-circuit while we're flushing.
 *
 * This is LD's homegrown telemetry — there is NO Sentry / LogRocket / Vercel
 * analytics / Google Analytics in the new site. Logs land server-side in
 * `shared.db.client_logs` only.
 */

const STORAGE_KEY = 'debug_log_pending'
const FLUSH_INTERVAL_MS = 5000
const HEARTBEAT_INTERVAL_MS = 30_000
const MAX_BUFFER = 50
const MAX_BREADCRUMBS = 20

interface InternalEntry extends ClientLogPayload {
  /** Internal id only — server assigns its own; useful for de-dupe in buffer. */
  _id: string
}

let initialized = false
let breadcrumbs: { time: string, type: string, value: string }[] = []
let original_console_error: typeof console.error | null = null
let in_console_error_patch = false
let flush_timer: ReturnType<typeof setInterval> | null = null
let heartbeat_timer: ReturnType<typeof setInterval> | null = null
/**
 * Fresh per `init_remote_logging()` call. Stamped on every log via `enrich()`
 * so the agent can group-by `context.session_id` to find all messages from
 * the same app run.
 */
let session_id = ''
let session_started_at_ms = 0

function get_build_target(): string | null {
  try {
    return (import.meta.env.VITE_TARGET as string | undefined) ?? null
  } catch {
    return null
  }
}

function safe_url(): string | null {
  try {
    return typeof window !== 'undefined' ? window.location?.href ?? null : null
  } catch {
    return null
  }
}

function safe_user_agent(): string | null {
  try {
    return typeof navigator !== 'undefined' ? navigator.userAgent ?? null : null
  } catch {
    return null
  }
}

function safe_pathname(): string | null {
  try {
    return typeof window !== 'undefined' ? window.location?.pathname ?? null : null
  } catch {
    return null
  }
}

function safe_visibility_state(): 'visible' | 'hidden' | null {
  try {
    if (typeof document === 'undefined')
      return null
    return document.visibilityState === 'hidden' ? 'hidden' : 'visible'
  } catch {
    return null
  }
}

/**
 * Returns used JS heap in MB when the runtime exposes `performance.memory`.
 * Chromium-only — other browsers return null here.
 */
function get_memory_mb(): number | null {
  try {
    if (typeof performance === 'undefined')
      return null
    const { memory } = performance as unknown as { memory?: { usedJSHeapSize?: number } }
    if (!memory?.usedJSHeapSize)
      return null
    return Math.round(memory.usedJSHeapSize / 1024 / 1024)
  } catch {
    return null
  }
}

/** Trim a stack to a manageable size (server clamps too, but save bytes on the wire). */
function clamp_stack(stack: string | undefined | null): string | null {
  if (!stack)
    return null
  return stack.length > 8000 ? stack.slice(0, 8000) : stack
}

function enrich(entry: ClientLogPayload): InternalEntry {
  return {
    _id: crypto.randomUUID(),
    ...entry,
    client_time: entry.client_time ?? new Date().toISOString(),
    url: entry.url ?? safe_url(),
    user_agent: entry.user_agent ?? safe_user_agent(),
    app_version: entry.app_version ?? version ?? null,
    build_target: entry.build_target ?? get_build_target(),
    context: {
      ...(entry.context ?? {}),
      session_id,
      breadcrumbs: breadcrumbs.slice(-MAX_BREADCRUMBS),
    },
  }
}

/**
 * localStorage is our single source of truth for pending entries — survives
 * page crashes, tab close, WebView teardown. No in-memory dup buffer because
 * the duplication let us lose the most-recent entries on crash.
 */
function read_pending(): InternalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return []
    const parsed = JSON.parse(raw) as InternalEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write_pending(entries: InternalEntry[]): void {
  try {
    if (entries.length === 0) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    // Keep only the most recent MAX_BUFFER entries — older ones drop on overflow
    // (e.g. offline tab for hours).
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_BUFFER)))
  } catch {
    // localStorage may throw (quota, private mode, etc.) — drop on the floor.
  }
}

function push(entry: ClientLogPayload): void {
  if (!initialized)
    return
  const pending = read_pending()
  pending.push(enrich(entry))
  write_pending(pending)
}

/**
 * Serial flush chain. Every `flush()` call appends a task that runs only
 * after the previous one resolves. Prevents two concurrent flushes from
 * sending the same entry twice.
 */
let flush_chain: Promise<void> = Promise.resolve()

function flush(): Promise<void> {
  const next = flush_chain.then(do_flush_once, do_flush_once)
  flush_chain = next.catch(() => { /* swallow so chain doesn't poison */ })
  return next
}

async function do_flush_once(): Promise<void> {
  if (!initialized)
    return
  const pending = read_pending()
  if (pending.length === 0)
    return

  // Strip the internal `_id` before sending. After api_log resolves we
  // re-read the buffer and remove only the IDs WE sent — any entry pushed
  // during the network roundtrip stays for the next flush.
  const entries = pending.map(({ _id: _omit, ...rest }) => rest)
  const { error } = await api_log({ entries })
  if (error)
    return
  const remaining = read_pending()
  const sent_ids = new Set(pending.map(p => p._id))
  write_pending(remaining.filter(e => !sent_ids.has(e._id)))
}

function flush_via_beacon(): void {
  if (!initialized)
    return
  const pending = read_pending()
  if (pending.length === 0)
    return
  const entries = pending.map(({ _id: _omit, ...rest }) => rest)
  const queued = send_log_beacon(entries)
  if (queued)
    write_pending([])
  // If the beacon couldn't queue (e.g. body too large), leave it for the
  // next session to retry on init.
}

/** Append a breadcrumb (e.g. user action, route change). Capped at MAX_BREADCRUMBS. */
export function add_breadcrumb({ type, value }: { type: string, value: string }): void {
  breadcrumbs.push({ time: new Date().toISOString(), type, value })
  if (breadcrumbs.length > MAX_BREADCRUMBS * 2)
    breadcrumbs = breadcrumbs.slice(-MAX_BREADCRUMBS)
}

/** Explicit logging — preferred over `console.error` when wired intentionally. */
export function log_event(entry: ClientLogPayload): void {
  push(entry)
}

/**
 * Track a route change as a breadcrumb AND emit a low-cost `info` log so we
 * have wall-clock route history in `client_logs`. Call from `+layout.svelte`'s
 * `afterNavigate` (when one is wired).
 */
export function log_navigation({ to, from }: { to: string, from?: string | null }): void {
  if (!initialized)
    return
  add_breadcrumb({ type: 'route', value: to })
  const elapsed_seconds = Math.round((Date.now() - session_started_at_ms) / 1000)
  push({
    level: 'info',
    message: 'navigation',
    context: {
      elapsed_seconds,
      from: from ?? null,
      to,
    },
  })
}

/** Force-flush right now (returns a promise). Useful from tests / debug UI. */
export async function flush_now(): Promise<void> {
  return await flush()
}

/**
 * Wire global handlers and patch `console.error`. Idempotent — safe to call
 * twice. Call once from `+layout.svelte` `onMount`.
 */
export function init_remote_logging(): void {
  if (initialized)
    return
  if (typeof window === 'undefined')
    return
  initialized = true
  session_id = crypto.randomUUID()
  session_started_at_ms = Date.now()

  window.addEventListener('error', (event) => {
    push({
      level: 'error',
      message: event.message || (event.error as Error)?.message || 'Uncaught error',
      stack: clamp_stack((event.error as Error)?.stack),
      context: {
        filename: event.filename ?? null,
        lineno: event.lineno ?? null,
        colno: event.colno ?? null,
      },
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const { reason } = event
    const message = reason instanceof Error
      ? reason.message
      : typeof reason === 'string' ? reason : safe_serialize_reason(reason)
    push({
      level: 'unhandled_rejection',
      message: message || 'Unhandled promise rejection',
      stack: clamp_stack(reason instanceof Error ? reason.stack : null),
    })
  })

  // Patch console.error so caught-and-logged errors elsewhere in the app
  // also reach the server. The `in_console_error_patch` flag short-circuits
  // re-entry (e.g. a third-party lib calling console.error from inside our
  // log pipeline) without blocking legitimate concurrent pushes.
  original_console_error = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    if (in_console_error_patch) {
      original_console_error?.(...args)
      return
    }
    in_console_error_patch = true
    try {
      original_console_error?.(...args)
      const [first] = args
      const message = first instanceof Error
        ? first.message
        : typeof first === 'string' ? first : safe_serialize_reason(first)
      const stack = first instanceof Error ? clamp_stack(first.stack) : null
      const extras = args.length > 1 ? args.slice(1).map(safe_serialize_reason) : null
      push({
        level: 'error',
        message: message || 'console.error',
        stack,
        context: extras ? { extras } : null,
      })
    } catch {
      // Never throw from console.error.
    } finally {
      in_console_error_patch = false
    }
  }

  // Proof-of-life ping. Lets us see in `client_logs` when each session begins
  // and (paired with the heartbeat below) measure session lifetimes.
  push({
    level: 'info',
    message: 'session_start',
    context: {
      memory_mb: get_memory_mb(),
      pathname: safe_pathname(),
      visibility: safe_visibility_state(),
    },
  })

  // Periodic flush. setInterval is fine — page lifetime is bounded.
  flush_timer = setInterval(() => {
    void flush()
  }, FLUSH_INTERVAL_MS)

  // Periodic heartbeat. Each tick we know the session was still alive at
  // `elapsed_seconds`.
  heartbeat_timer = setInterval(() => {
    const elapsed_seconds = Math.round((Date.now() - session_started_at_ms) / 1000)
    push({
      level: 'info',
      message: 'heartbeat',
      context: {
        elapsed_seconds,
        memory_mb: get_memory_mb(),
        pathname: safe_pathname(),
        visibility: safe_visibility_state(),
      },
    })
  }, HEARTBEAT_INTERVAL_MS)

  // On hide / navigate-away, send the final batch via beacon (survives page teardown).
  window.addEventListener('pagehide', flush_via_beacon)
  window.addEventListener('visibilitychange', () => {
    push({
      level: 'info',
      message: `visibility_${document.visibilityState}`,
      context: {
        elapsed_seconds: Math.round((Date.now() - session_started_at_ms) / 1000),
        pathname: safe_pathname(),
      },
    })
    if (document.visibilityState === 'hidden')
      flush_via_beacon()
  })

  // Try a flush right away — picks up offline-buffered entries from a prior crash.
  void flush()
}

function safe_serialize_reason(value: unknown): string {
  if (value === null || value === undefined)
    return ''
  if (typeof value === 'string')
    return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** Test-only: tear down all state so a clean test can re-init. */
export function _reset_for_tests(): void {
  if (original_console_error) {
    console.error = original_console_error
    original_console_error = null
  }
  if (flush_timer) {
    clearInterval(flush_timer)
    flush_timer = null
  }
  if (heartbeat_timer) {
    clearInterval(heartbeat_timer)
    heartbeat_timer = null
  }
  breadcrumbs = []
  initialized = false
  in_console_error_patch = false
  session_id = ''
  session_started_at_ms = 0
  flush_chain = Promise.resolve()
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}
