import { log_event } from '$lib/debug/remote-log'

/**
 * Recovery policy for a live query whose RPC to the leader worker timed out
 * (`error.code === 'timeout'`). The leader may be cold-booting or mid hand-off
 * after a resign — the OLD behavior was to log an error once and PERMANENTLY
 * give up (a dead, blank panel until the user re-navigated). Instead the
 * table-stores now retry with backoff and recover when a leader (re)appears.
 *
 * Ported from house (`.issues/reader-livedb-subscription-timeout.md` /
 * `.issues/reader-media-no-server-fallback.md`): the per-dict reactive reads run
 * over the SAME byte-identical OPFS leader-worker harness, so the same wedge
 * (`RPC timed out (no leader responded)`) could permanently dead-panel a
 * dictionary entry view. Consumed by `DictTableStore` in
 * `dict-client/dict-live-db.svelte.ts`.
 */

export const LIVE_QUERY_RETRY_BASE_MS = 1000
export const LIVE_QUERY_RETRY_MAX_MS = 8000
/** ~1+2+4+8 s of backoff across 4 retries — outlasts a leader resign→re-elect→boot. */
export const LIVE_QUERY_MAX_RETRIES = 4

export type LiveQuerySource = 'admin' | 'viewer' | 'dict'

/** Only a transport timeout is transient (leader booting / handing off); everything else is a real failure we surface immediately. */
export function is_retryable_live_error(error: unknown): boolean {
  return (error as { code?: string } | null | undefined)?.code === 'timeout'
}

export function live_query_backoff_ms(attempt: number): number {
  return Math.min(LIVE_QUERY_RETRY_BASE_MS * 2 ** attempt, LIVE_QUERY_RETRY_MAX_MS)
}

/** Pure retry decision — the unit-testable core of the recovery loop. */
export function compute_retry_decision({ error, attempt, has_subscribers }: {
  error: unknown
  attempt: number
  has_subscribers: boolean
}): { retryable: boolean, will_retry: boolean, delay_ms: number } {
  const retryable = is_retryable_live_error(error)
  const will_retry = retryable && attempt < LIVE_QUERY_MAX_RETRIES && has_subscribers
  return { retryable, will_retry, delay_ms: will_retry ? live_query_backoff_ms(attempt) : 0 }
}

/**
 * A single transient timeout — WARN, not error: it is now self-healing (a retry
 * is scheduled). The review watches the RATE and `had_leader` (false → the leader
 * never came ready, i.e. a boot/election fault; true → a leader exists but the
 * RPC still timed out, i.e. a slow query or a mid-flight hand-off).
 */
export function log_live_query_timeout({ table, source, waited_ms, attempt, will_retry, had_leader }: {
  table: string
  source: LiveQuerySource
  waited_ms: number
  attempt: number
  will_retry: boolean
  had_leader: boolean | null
}): void {
  log_event({ level: 'warn', message: 'live_query_timeout', context: { op: 'query', table, source, waited_ms, attempt, will_retry, had_leader } })
}

/**
 * Retries EXHAUSTED — ERROR. The panel genuinely couldn't load from the local DB
 * and falls back to empty. THIS is the real signal to act on. `had_leader:false`
 * concentration → pursue the wedged-leader / OPFS-handle fix.
 */
export function log_live_query_failed({ table, source, waited_ms, attempts, had_leader, code }: {
  table: string
  source: LiveQuerySource
  waited_ms: number
  attempts: number
  had_leader: boolean | null
  code: string | null
}): void {
  log_event({ level: 'error', message: 'live_query_failed', context: { op: 'query', table, source, waited_ms, attempts, had_leader, code } })
}

/**
 * A query that previously timed out then SUCCEEDED — INFO. Proof the recovery
 * path works; a rising count means transient leader stalls are common (a nudge
 * toward the wedged-leader fix even though users aren't seeing failures).
 */
export function log_live_query_recovered({ table, source, attempts, total_wait_ms, had_leader }: {
  table: string
  source: LiveQuerySource
  attempts: number
  total_wait_ms: number
  had_leader: boolean | null
}): void {
  log_event({ level: 'info', message: 'live_query_recovered', context: { op: 'query', table, source, attempts, total_wait_ms, had_leader } })
}

if (import.meta.vitest) {
  describe(is_retryable_live_error, () => {
    it('treats a transport timeout as retryable', () => {
      expect(is_retryable_live_error(Object.assign(new Error('x'), { code: 'timeout' }))).toBe(true)
    })
    it('treats other errors (and nullish) as non-retryable', () => {
      expect(is_retryable_live_error(Object.assign(new Error('x'), { code: 'internal' }))).toBe(false)
      expect(is_retryable_live_error(new Error('no code'))).toBe(false)
      expect(is_retryable_live_error(null)).toBe(false)
      expect(is_retryable_live_error(undefined)).toBe(false)
    })
  })

  describe(live_query_backoff_ms, () => {
    it('grows exponentially then caps at the max', () => {
      expect(live_query_backoff_ms(0)).toBe(1000)
      expect(live_query_backoff_ms(1)).toBe(2000)
      expect(live_query_backoff_ms(2)).toBe(4000)
      expect(live_query_backoff_ms(3)).toBe(8000)
      expect(live_query_backoff_ms(10)).toBe(LIVE_QUERY_RETRY_MAX_MS)
    })
  })

  describe(compute_retry_decision, () => {
    const timeout = Object.assign(new Error('RPC timed out'), { code: 'timeout' })
    it('retries a timeout while attempts remain and there are subscribers', () => {
      expect(compute_retry_decision({ error: timeout, attempt: 0, has_subscribers: true })).toEqual({ retryable: true, will_retry: true, delay_ms: 1000 })
    })
    it('stops retrying once the attempt budget is spent', () => {
      const decision = compute_retry_decision({ error: timeout, attempt: LIVE_QUERY_MAX_RETRIES, has_subscribers: true })
      expect(decision.will_retry).toBe(false)
      expect(decision.retryable).toBe(true)
    })
    it('does not retry when the component has detached (no subscribers)', () => {
      expect(compute_retry_decision({ error: timeout, attempt: 0, has_subscribers: false }).will_retry).toBe(false)
    })
    it('does not retry a non-timeout error', () => {
      const decision = compute_retry_decision({ error: Object.assign(new Error('boom'), { code: 'internal' }), attempt: 0, has_subscribers: true })
      expect(decision).toEqual({ retryable: false, will_retry: false, delay_ms: 0 })
    })
  })
}
