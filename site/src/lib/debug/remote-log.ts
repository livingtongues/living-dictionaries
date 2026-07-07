import type { ClientLogPayload } from '$lib/server/insert-client-log'
import { api_log, send_log_beacon } from '$api/log/_call'
import { version } from '$app/environment'
import { detect_db_capabilities, resolve_db_tier } from '$lib/db/dict-client/worker/db-capabilities'

/**
 * Client-side error capture + remote-log shipper. Initialized once from
 * `+layout.svelte` `onMount` on app boot.
 *
 * Captures four channels:
 *  1. `window.error`                  — uncaught synchronous errors
 *  2. `window.unhandledrejection`     — uncaught rejected promises
 *  3. `console.error`                 — explicit error logging in app code
 *  4. `log_event(...)` / `log_warning(...)` — explicit calls (info / warn / crash)
 *
 * NOTE: `console.warn` is deliberately NOT patched. Most browser warnings are
 * operational / 3rd-party noise (sync retries, snapshot-fail on every new dict,
 * deprecations, private-mode localStorage). Shipping a warning to telemetry is an
 * explicit, curated decision — call `log_warning(...)` for the ones we can action.
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
 * Ported from tutor/site/src/lib/debug/remote-log.ts.
 */

const STORAGE_KEY = 'debug_log_pending'
const FLUSH_INTERVAL_MS = 5000
const HEARTBEAT_INTERVAL_MS = 30_000
/**
 * A visible tab left untouched this long stops counting as engagement: heartbeats
 * pause until the next user interaction. Caps the "left a tab open all day" case
 * (e.g. an 11h idle-but-focused session = ~1,200 phantom heartbeats) that
 * visibility-gating alone misses. Any pointer/key/scroll/visibility-return resets it.
 */
const IDLE_TIMEOUT_MS = 5 * 60_000
const MAX_BUFFER = 50
const MAX_BREADCRUMBS = 20
const MAX_BREADCRUMB_LABEL = 80

/**
 * Substring patterns for log messages that are pure noise — they get dropped at
 * `push()` (the single chokepoint all four channels funnel through) so they never
 * buffer, ship, or pollute the error channel. Each was confirmed as high-volume,
 * zero-diagnostic-value noise in a `log-and-fix` review:
 *  - `ResizeObserver loop…`     — benign browser layout warning (147×/day).
 *  - `[GSI_LOGGER]`             — Google One Tap / FedCM abort + network noise.
 *  - `Sync already in progress` — benign leader-race guard; a second surface beat
 *                                 us to `ensure_initial_sync`, reactive stores fill anyway.
 *  - `Failed to initialize WebGL` — Mapbox-internal async WebGL-context failure on
 *                                 the homepage globe (GPU blocklist / disabled). The
 *                                 user's environment, not our bug; `Map.svelte` already
 *                                 logs one clean `Map failed to load (WebGL unavailable)`
 *                                 for the synchronous case + keeps a placeholder, so this
 *                                 raw async stack is undiagnosable noise.
 * NOT filtered: `RPC timed out (no leader responded)` — low-volume but a real
 * signal of a leader-election stall under multi-tab load; keep it visible.
 */
const NOISE_MESSAGE_PATTERNS = [
  'ResizeObserver loop',
  '[GSI_LOGGER]',
  'Sync already in progress',
  'Failed to initialize WebGL',
]

function is_noise_message(message: string | undefined | null): boolean {
  if (!message)
    return false
  return NOISE_MESSAGE_PATTERNS.some(pattern => message.includes(pattern))
}

interface InternalEntry extends ClientLogPayload {
  /** Internal id only — server assigns its own; useful for de-dupe in buffer. */
  _id: string
}

let initialized = false
/**
 * Events emitted BEFORE `init_remote_logging()` runs (e.g. a `track()` from a
 * child-layout `$effect` that fires before the root layout's `onMount` inits the
 * logger — the case for a user landing directly on a deep link). Held in memory
 * and replayed through `push()` on init so the first `dictionary_opened` /
 * `entry_opened` of a fresh page load isn't silently dropped.
 */
let pre_init_buffer: ClientLogPayload[] = []
let breadcrumbs: { time: string, type: string, value: string }[] = []
let original_console_error: typeof console.error | null = null
let in_console_error_patch = false
let flush_timer: ReturnType<typeof setInterval> | null = null
let heartbeat_timer: ReturnType<typeof setInterval> | null = null
/** Window listeners we registered, tracked so `_reset_for_tests` can remove them. */
let registered_listeners: { type: string, handler: EventListener, options?: AddEventListenerOptions | boolean }[] = []

function on_window(type: string, handler: EventListener, options?: AddEventListenerOptions | boolean): void {
  window.addEventListener(type, handler, options)
  registered_listeners.push({ type, handler, options })
}
/**
 * Fresh per `init_remote_logging()` call. Stamped on every log via `enrich()`
 * so the agent can group-by `context.session_id` to find all messages from
 * the same app run.
 */
let session_id = ''
let session_started_at_ms = 0
/** Epoch ms of the last real user interaction — drives the heartbeat idle gate. */
let last_activity_at_ms = 0

/** The current remote-log session id ('' before init) — threaded into worker telemetry (`InstanceOptions.session_id`). */
export function get_session_id(): string {
  return session_id
}

/**
 * A cookieless, persistent per-browser id — generated once, stored in
 * localStorage, reused across every page load AND across days. Where `session_id`
 * resets each page load (→ "visits"), `visitor_id` is stable per browser/device
 * (→ "visitors"). Chosen over a server IP+UA hash because it doesn't collapse a
 * whole shared-connection community (NAT) into one visitor — common for LD's
 * dictionary communities. NOT personal data (a random UUID we mint and never join
 * to identity), so no cookie/consent surface. "Visitors" here means distinct
 * browsers/devices, not humans — the universal analytics meaning.
 */
const VISITOR_ID_KEY = 'ld_visitor_id'
let visitor_id = ''

/** Read-or-create the persistent visitor id. Sync (localStorage) so it's ready before the first `session_start`. */
function ensure_visitor_id(): string {
  if (visitor_id)
    return visitor_id
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY)
    if (existing) {
      visitor_id = existing
      return visitor_id
    }
    visitor_id = crypto.randomUUID()
    localStorage.setItem(VISITOR_ID_KEY, visitor_id)
  } catch {
    // Private mode / disabled storage: fall back to a per-session id so the row
    // still carries *a* visitor_id (server COALESCEs to session_id anyway).
    visitor_id = visitor_id || crypto.randomUUID()
  }
  return visitor_id
}

/** House is a web app today; a native client would override `platform` via the payload. */
function get_platform(): 'web' | 'ios' | 'android' {
  return 'web'
}

/**
 * Build / runtime target. Honors an explicit `VITE_TARGET` if a build ever sets
 * one (none today — the site is web-only); otherwise derives the deploy environment
 * from the hostname so the log review can separate real-user prod traffic from
 * local/preview test noise:
 *  - `livingdictionaries.app` / `*.livingdictionaries.app` → `'production'`
 *    (covers the `new.` subdomain we run pre-cutover)
 *  - `localhost` / `127.*` / `::1`    → `'development'`
 *  - anything else                    → `'preview'`
 */
function get_build_target(): string | null {
  try {
    const explicit = (import.meta.env.VITE_TARGET as string | undefined) ?? null
    if (explicit)
      return explicit
    if (typeof window === 'undefined')
      return null
    const host = window.location?.hostname ?? ''
    if (!host)
      return null
    if (host === 'localhost' || host.startsWith('127.') || host === '::1' || host === '0.0.0.0')
      return 'development'
    if (host === 'livingdictionaries.app' || host.endsWith('.livingdictionaries.app'))
      return 'production'
    return 'preview'
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

/**
 * Flatten the local-first DB capability flags + the resolved tier for the
 * `session_start` context. Never throws (detection is all guarded probes).
 */
function db_capabilities_for_log(): Record<string, unknown> {
  try {
    const caps = detect_db_capabilities()
    return {
      has_opfs: caps.has_opfs,
      has_web_locks: caps.has_web_locks,
      has_broadcast_channel: caps.has_broadcast_channel,
      has_worker: caps.has_worker,
      has_indexed_db: caps.has_indexed_db,
      db_tier: resolve_db_tier(caps) ?? 'ssr-floor',
    }
  } catch {
    return {}
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

/**
 * `navigator.webdriver` is `true` under Playwright/Selenium/other automation —
 * the reliable "this is a bot" signal a user-agent regex CANNOT catch (headed
 * Playwright reports a plain Chrome UA). Stamped on EVERY row's context (only
 * when true, to keep context lean) so the analytics human/bot filter can exclude
 * a whole automated session per-row, not just its `session_start`. Cached — it's
 * a stable per-page property. Guarded: never throws.
 */
let webdriver_cached: boolean | null = null
function is_webdriver(): boolean {
  if (webdriver_cached === null) {
    try {
      webdriver_cached = typeof navigator !== 'undefined' && navigator.webdriver === true
    } catch {
      webdriver_cached = false
    }
  }
  return webdriver_cached
}

function enrich(entry: ClientLogPayload): InternalEntry {
  return {
    _id: crypto.randomUUID(),
    ...entry,
    client_time: entry.client_time ?? new Date().toISOString(),
    url: entry.url ?? safe_url(),
    user_agent: entry.user_agent ?? safe_user_agent(),
    platform: entry.platform ?? get_platform(),
    app_version: entry.app_version ?? version ?? null,
    build_target: entry.build_target ?? get_build_target(),
    context: {
      ...(entry.context ?? {}),
      session_id,
      visitor_id: visitor_id || ensure_visitor_id(),
      breadcrumbs: breadcrumbs.slice(-MAX_BREADCRUMBS),
      ...(is_webdriver() ? { webdriver: true } : {}),
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
  if (is_noise_message(entry.message))
    return
  if (!initialized) {
    // Buffer until init replays these (capped — drop oldest on overflow).
    pre_init_buffer.push(entry)
    if (pre_init_buffer.length > MAX_BUFFER)
      pre_init_buffer = pre_init_buffer.slice(-MAX_BUFFER)
    return
  }
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

/**
 * Describe a clicked element for a breadcrumb. Walks up to the nearest
 * actionable ancestor (link / button / role=button / explicit `data-breadcrumb`)
 * and labels it by `data-breadcrumb` → `aria-label` → trimmed text → `href` →
 * tag. Returns null for clicks on inert chrome so we don't record noise.
 */
function describe_click_target(target: EventTarget | null): string | null {
  if (!(target instanceof Element))
    return null
  const el = target.closest('a, button, [role="button"], [data-breadcrumb]')
  if (!el)
    return null
  const label
    = el.getAttribute('data-breadcrumb')
      || el.getAttribute('aria-label')
      || (el.textContent ?? '').replace(/\s+/g, ' ').trim()
      || el.getAttribute('href')
      || el.tagName.toLowerCase()
  return label ? label.slice(0, MAX_BREADCRUMB_LABEL) : null
}

/** Explicit logging — preferred over `console.error` when wired intentionally. */
export function log_event(entry: ClientLogPayload): void {
  push(entry)
}

/**
 * Ship an ACTIONABLE warning to `client_logs` at `warn` level — the deliberate,
 * curated alternative to a bare `console.warn` (which is intentionally NOT
 * auto-captured; see the header note). Use this only for warnings WE can act on
 * (data-integrity, missing-key, etc.), not operational/3rd-party churn. Mirrors to
 * the dev `console.warn` so local debugging is unchanged.
 */
export function log_warning({ message, context }: { message: string, context?: Record<string, unknown> }): void {
  console.warn(message, context ?? '')
  push({ level: 'warn', message, context: context ?? null })
}

/**
 * Analytics event (the GA half). `event` MUST come from the stable vocabulary in
 * `$lib/debug/log-events.ts` — it is stored as the row `message` (same shape as
 * `navigation`/`perf`/`heartbeat`) so the daily `log_daily_metrics` rollup can
 * group on it; free-form strings don't aggregate. Structured fields go under
 * `props`. Info level. Also drops an `event` breadcrumb so the action shows up in
 * the trail of any later error.
 */
export function track({ event, props }: { event: string, props?: Record<string, unknown> }): void {
  add_breadcrumb({ type: 'event', value: event })
  push({
    level: 'info',
    message: event,
    context: { ...(props ?? {}) },
  })
}

/**
 * Track a route change as a breadcrumb AND emit a low-cost `info` log so we
 * have wall-clock route history in `client_logs`. Call from `+layout.svelte`'s
 * `afterNavigate`. `duration_ms` (when known — client-side navs measured from
 * `beforeNavigate`) folds into the same event so we don't double the row count.
 */
export function log_navigation({ to, from, duration_ms }: { to: string, from?: string | null, duration_ms?: number | null }): void {
  if (!initialized)
    return
  // Same-pathname navigations are query-only churn (search-as-you-type `?q=`,
  // pagination) — one heavy edit session logged 1,869 `/x/entries → /x/entries`
  // rows (2026-07-03) and drowned real route data. `search_performed` already
  // covers the search activity; skip both the event and the breadcrumb.
  if (from === to)
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
      ...(typeof duration_ms === 'number' ? { duration_ms: Math.round(duration_ms) } : {}),
    },
  })
}

/**
 * Emit a performance timing as a `perf` info event. The `name` is a stable
 * label (`page_load` | `search` | `viewer_boot` | …) the A3 log review groups on
 * — `context.duration_ms` carries the value, plus any extra fields.
 */
export function track_timing({ name, duration_ms, context }: { name: string, duration_ms: number, context?: Record<string, unknown> }): void {
  if (!initialized)
    return
  push({
    level: 'info',
    message: 'perf',
    context: {
      name,
      duration_ms: Math.round(duration_ms),
      ...(context ?? {}),
    },
  })
}

/**
 * Emit a Web Vital (LCP / INP / CLS / FCP / TTFB). Shares the `perf` channel
 * under `context.name = 'web_vital'`. `value` is rounded to 3 decimals so CLS
 * (unitless, e.g. 0.052) keeps precision while ms metrics round cleanly.
 */
export function track_web_vital({ metric, value, rating, navigation_type }: { metric: string, value: number, rating?: string, navigation_type?: string }): void {
  if (!initialized)
    return
  push({
    level: 'info',
    message: 'perf',
    context: {
      name: 'web_vital',
      metric,
      value: Math.round(value * 1000) / 1000,
      rating: rating ?? null,
      navigation_type: navigation_type ?? null,
    },
  })
}

/** Force-flush right now (returns a promise). Useful from tests / debug UI. */
export async function flush_now(): Promise<void> {
  return await flush()
}

/**
 * Wire global handlers and patch `console.error`. Idempotent — safe to call
 * twice. Call once from `+layout.svelte` `onMount` after the auth/region
 * setup so the enrichment fields are populated.
 */
export function init_remote_logging(): void {
  if (initialized)
    return
  if (typeof window === 'undefined')
    return
  initialized = true
  session_id = crypto.randomUUID()
  ensure_visitor_id()
  session_started_at_ms = Date.now()

  // Replay anything emitted before init (now that session enrichment is ready).
  if (pre_init_buffer.length) {
    const buffered = pre_init_buffer
    pre_init_buffer = []
    for (const entry of buffered)
      push(entry)
  }

  on_window('error', (event) => {
    const error_event = event as ErrorEvent
    push({
      level: 'error',
      message: error_event.message || (error_event.error as Error)?.message || 'Uncaught error',
      stack: clamp_stack((error_event.error as Error)?.stack),
      context: {
        filename: error_event.filename ?? null,
        lineno: error_event.lineno ?? null,
        colno: error_event.colno ?? null,
      },
    })
  })

  on_window('unhandledrejection', (event) => {
    const { reason } = event as PromiseRejectionEvent
    const message = reason instanceof Error
      ? reason.message
      : typeof reason === 'string' ? reason : safe_serialize_reason(reason)
    push({
      level: 'unhandled_rejection',
      message: message || 'Unhandled promise rejection',
      stack: clamp_stack(reason instanceof Error ? reason.stack : null),
    })
  })

  // Global click breadcrumbs. Capture phase so the action is recorded even when
  // the handler navigates away or stops propagation. Only actionable targets are
  // recorded, and breadcrumbs live in memory (last MAX_BREADCRUMBS) shipped only
  // attached to errors — cheap context, never its own log row.
  on_window('click', (event) => {
    try {
      const label = describe_click_target(event.target)
      if (label)
        add_breadcrumb({ type: 'click', value: label })
    } catch {
      // Never let breadcrumb capture break a click.
    }
  }, { capture: true })

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
      // Device fitness for the local-first DB, captured up front so we can see
      // which tier (opfs-worker / idb-worker / idb-main / SSR-floor) each session
      // can run — even anonymously, even if the DB later fails to open. This is
      // how we make the old-Safari / no-OPFS population (e.g. Wayne's Catalina)
      // VISIBLE instead of eyeballing raw user_agent strings. See
      // .issues/no-opfs-idb-fallback-tiers.md.
      ...db_capabilities_for_log(),
    },
  })

  // Periodic flush. setInterval is fine — page lifetime is bounded.
  flush_timer = setInterval(() => {
    void flush()
  }, FLUSH_INTERVAL_MS)

  // Track real user interaction so an idle-but-visible tab stops emitting
  // heartbeats (see IDLE_TIMEOUT_MS). Passive listeners; any one resets the clock.
  last_activity_at_ms = Date.now()
  const mark_activity: EventListener = () => { last_activity_at_ms = Date.now() }
  for (const activity_event of ['pointerdown', 'keydown', 'scroll', 'pointermove'])
    on_window(activity_event, mark_activity, { passive: true })

  // Periodic heartbeat. Each tick we know the session was still alive at
  // `elapsed_seconds`. SKIP the tick while the tab is hidden OR idle —
  // backgrounded/untouched admin tabs left open are the dominant source of log
  // volume, and the `visibility_hidden`/`visibility_visible` events already
  // bracket the gap so session-span is preserved. A heartbeat = "alive AND
  // visible AND engaged". (Ported from house's log-volume buildout.)
  heartbeat_timer = setInterval(() => {
    if (safe_visibility_state() === 'hidden')
      return
    if (Date.now() - last_activity_at_ms > IDLE_TIMEOUT_MS)
      return
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
  on_window('pagehide', flush_via_beacon)
  on_window('visibilitychange', () => {
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
    else
      last_activity_at_ms = Date.now()
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
  for (const { type, handler, options } of registered_listeners) {
    try {
      window.removeEventListener(type, handler, options)
    } catch {}
  }
  registered_listeners = []
  breadcrumbs = []
  pre_init_buffer = []
  initialized = false
  in_console_error_patch = false
  session_id = ''
  session_started_at_ms = 0
  last_activity_at_ms = 0
  flush_chain = Promise.resolve()
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}
