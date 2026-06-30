/**
 * @vitest-environment happy-dom
 *
 * Buffer + flush behavior for the remote-log shipper. The DOM globals
 * (`localStorage`, `window`, `navigator`) require happy-dom — set per-file
 * via the docblock since most tests run on `node`.
 *
 * Ported from tutor/site/src/lib/debug/remote-log.test.ts (+ log_navigation coverage).
 */

import type { ApiLogRequestBody, ApiLogResponseBody } from '$api/log/+server'
import type { ClientLogPayload } from '$lib/server/insert-client-log'

type ApiLogResult = { data: ApiLogResponseBody, error: null } | { data: null, error: { status: number, message: string } }
const api_log_mock = vi.hoisted(() => vi.fn((_body: ApiLogRequestBody): Promise<ApiLogResult> => Promise.resolve({ data: { ok: true, accepted: 1 }, error: null })))
const send_log_beacon_mock = vi.hoisted(() => vi.fn((_entries: ClientLogPayload[]) => true))

vi.mock('$api/log/_call', () => ({
  api_log: api_log_mock,
  send_log_beacon: send_log_beacon_mock,
}))

beforeEach(async () => {
  api_log_mock.mockReset()
  api_log_mock.mockImplementation(() => Promise.resolve({ data: { ok: true, accepted: 1 }, error: null }))
  send_log_beacon_mock.mockReset()
  send_log_beacon_mock.mockImplementation(() => true)
  localStorage.clear()
  const module = await import('./remote-log')
  module._reset_for_tests()
})

/** Look across every api_log call this test made and return any entry matching the message. */
function find_sent_entry(message: string): ClientLogPayload | undefined {
  for (const [body] of api_log_mock.mock.calls) {
    const call = body as ApiLogRequestBody & { entries: ClientLogPayload[] }
    const found = call.entries.find(entry => entry.message === message)
    if (found)
      return found
  }
  return undefined
}

function all_sent_entries(): ClientLogPayload[] {
  const out: ClientLogPayload[] = []
  for (const [body] of api_log_mock.mock.calls) {
    const call = body as ApiLogRequestBody & { entries: ClientLogPayload[] }
    out.push(...call.entries)
  }
  return out
}

describe('remote-log buffer + flush', () => {
  test('buffers an entry and flushes via api_log', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    module.log_event({ level: 'error', message: 'unit-test boom' })
    await module.flush_now()

    const boom = find_sent_entry('unit-test boom')
    expect(boom).toBeTruthy()
    expect(boom?.client_time).toBeTruthy()
  })

  test('drops known-noise messages so they never buffer or ship', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    // Each substring in NOISE_MESSAGE_PATTERNS — dropped regardless of level.
    module.log_event({ level: 'error', message: 'ResizeObserver loop completed with undelivered notifications.' })
    module.log_event({ level: 'error', message: '[GSI_LOGGER]: FedCM get() rejects with AbortError' })
    module.log_event({ level: 'unhandled_rejection', message: 'Sync already in progress' })
    // A real error sharing the flush must still get through.
    module.log_event({ level: 'error', message: 'real-error-survives' })
    await module.flush_now()

    const sent = all_sent_entries().map(entry => entry.message)
    expect(sent).toContain('real-error-survives')
    expect(sent.some(message => message.includes('ResizeObserver loop'))).toBeFalsy()
    expect(sent.some(message => message.includes('[GSI_LOGGER]'))).toBeFalsy()
    expect(sent.some(message => message.includes('Sync already in progress'))).toBeFalsy()
  })

  test('keeps RPC-timeout messages — they are a real leader-stall signal, not noise', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    module.log_event({ level: 'unhandled_rejection', message: 'RPC timed out (no leader responded)' })
    await module.flush_now()

    expect(find_sent_entry('RPC timed out (no leader responded)')).toBeTruthy()
  })

  test('attaches breadcrumbs to context', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    module.add_breadcrumb({ type: 'route', value: '/search' })
    module.add_breadcrumb({ type: 'click', value: 'play-button' })
    module.log_event({ level: 'crash', message: 'with-breadcrumbs' })
    await module.flush_now()

    const entry = find_sent_entry('with-breadcrumbs')
    const context = entry?.context as { breadcrumbs: { type: string }[] }
    expect(context.breadcrumbs).toHaveLength(2)
    expect(context.breadcrumbs[0].type).toBe('route')
    expect(context.breadcrumbs[1].type).toBe('click')
  })

  test('records a click breadcrumb for actionable targets and attaches it to later errors', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()

    const button = document.createElement('button')
    button.textContent = '  Play  audio  '
    document.body.appendChild(button)
    const inert = document.createElement('div')
    document.body.appendChild(inert)

    inert.click() // inert chrome — should NOT record
    button.click() // actionable — should record "Play audio"

    module.log_event({ level: 'error', message: 'after-click' })
    await module.flush_now()

    const entry = find_sent_entry('after-click')
    const crumbs = (entry?.context as { breadcrumbs: { type: string, value: string }[] }).breadcrumbs
    const clicks = crumbs.filter(crumb => crumb.type === 'click')
    expect(clicks).toHaveLength(1)
    expect(clicks[0].value).toBe('Play audio')

    button.remove()
    inert.remove()
  })

  test('log_navigation emits a navigation event and adds a route breadcrumb to later errors', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    module.log_navigation({ to: '/search', from: '/' })
    module.log_event({ level: 'error', message: 'after-nav' })
    await module.flush_now()

    const nav = find_sent_entry('navigation')
    expect(nav).toBeTruthy()
    expect(nav?.level).toBe('info')
    const nav_context = nav?.context as { to: string, from: string | null, elapsed_seconds: number }
    expect(nav_context.to).toBe('/search')
    expect(nav_context.from).toBe('/')

    // The navigation must also leave a route breadcrumb so any subsequent error
    // ships with the trail that led to it (the gap this wiring closes).
    const after = find_sent_entry('after-nav')
    const crumbs = (after?.context as { breadcrumbs: { type: string, value: string }[] }).breadcrumbs
    expect(crumbs.some(crumb => crumb.type === 'route' && crumb.value === '/search')).toBeTruthy()
  })

  test('log_navigation folds duration_ms into the navigation event when provided', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    module.log_navigation({ to: '/search', from: '/', duration_ms: 142.7 })
    await module.flush_now()

    const nav = find_sent_entry('navigation')
    const context = nav?.context as { duration_ms?: number }
    expect(context.duration_ms).toBe(143) // rounded
  })

  test('log_navigation omits duration_ms when not provided', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    module.log_navigation({ to: '/', from: null })
    await module.flush_now()

    const nav = find_sent_entry('navigation')
    expect((nav?.context as Record<string, unknown>).duration_ms).toBeUndefined()
  })

  test('track emits an info event named after the event with props as context + an event breadcrumb', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    module.track({ event: 'search_performed', props: { query: 'jesus', query_len: 5, result_count: 12, zero_results: false } })
    module.log_event({ level: 'error', message: 'after-track' })
    await module.flush_now()

    const event = find_sent_entry('search_performed')
    expect(event?.level).toBe('info')
    const context = event?.context as { query: string, result_count: number, zero_results: boolean }
    expect(context.query).toBe('jesus')
    expect(context.result_count).toBe(12)
    expect(context.zero_results).toBeFalsy()

    // The tracked event also lands as a breadcrumb on a later error.
    const after = find_sent_entry('after-track')
    const crumbs = (after?.context as { breadcrumbs: { type: string, value: string }[] }).breadcrumbs
    expect(crumbs.some(crumb => crumb.type === 'event' && crumb.value === 'search_performed')).toBeTruthy()
  })

  test('track BEFORE init is buffered and replayed once init runs (deep-link race)', async () => {
    const module = await import('./remote-log')
    // Emitted before init — e.g. a child-layout $effect that beats the root onMount.
    module.track({ event: 'dictionary_opened', props: { dictionary_id: 'pre-init-dict' } })
    module.init_remote_logging()
    await module.flush_now()

    const event = find_sent_entry('dictionary_opened')
    expect(event?.level).toBe('info')
    expect((event?.context as { dictionary_id: string }).dictionary_id).toBe('pre-init-dict')
  })

  test('track_timing emits a perf event with rounded duration + extra context', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    module.track_timing({ name: 'page_load', duration_ms: 1234.6, context: { ttfb: 88 } })
    await module.flush_now()

    const perf = find_sent_entry('perf')
    const context = perf?.context as { name: string, duration_ms: number, ttfb: number }
    expect(perf?.level).toBe('info')
    expect(context.name).toBe('page_load')
    expect(context.duration_ms).toBe(1235)
    expect(context.ttfb).toBe(88)
  })

  test('track_web_vital keeps CLS precision and rounds ms metrics', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    module.track_web_vital({ metric: 'CLS', value: 0.05234, rating: 'good' })
    module.track_web_vital({ metric: 'LCP', value: 2500.4, rating: 'good', navigation_type: 'navigate' })
    await module.flush_now()

    const vitals = all_sent_entries().filter(entry => entry.message === 'perf' && (entry.context as { name?: string }).name === 'web_vital')
    const cls = vitals.find(entry => (entry.context as { metric: string }).metric === 'CLS')
    const lcp = vitals.find(entry => (entry.context as { metric: string }).metric === 'LCP')
    expect((cls?.context as { value: number }).value).toBe(0.052) // 5-decimal CLS clamped to 3
    expect((lcp?.context as { value: number }).value).toBe(2500.4) // ms metric kept to 3 decimals
    expect((lcp?.context as { navigation_type: string }).navigation_type).toBe('navigate')
  })

  test('persists to localStorage when api_log fails, retries on next flush', async () => {
    let call_count = 0
    api_log_mock.mockImplementation(() => {
      call_count++
      // First TWO calls fail: one is the init's auto-flush, one is the
      // explicit flush_now below. Both must fail for localStorage to retain
      // pending entries. Third+ call succeeds → drains buffer.
      if (call_count <= 2)
        return Promise.resolve({ data: null, error: { status: 0, message: 'offline' } })
      return Promise.resolve({ data: { ok: true, accepted: 1 }, error: null })
    })

    const module = await import('./remote-log')
    module.init_remote_logging()
    module.log_event({ level: 'error', message: 'flaky-network' })
    await module.flush_now()

    const stored = JSON.parse(localStorage.getItem('debug_log_pending') ?? '[]') as { message: string }[]
    // session_start (queued on init) + flaky-network user log = 2.
    expect(stored).toHaveLength(2)
    expect(stored.some(entry => entry.message === 'flaky-network')).toBeTruthy()

    // Third call succeeds → buffer drains.
    await module.flush_now()
    expect(localStorage.getItem('debug_log_pending')).toBeNull()
    expect(call_count).toBe(3)
  })

  test('console.error patch forwards to the buffer', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    console.error('forwarded message', { extra: 1 })
    await module.flush_now()

    const forwarded = find_sent_entry('forwarded message')
    expect(forwarded?.level).toBe('error')
  })

  test('log_warning ships at warn level', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    module.log_warning({ message: 'actionable warning', context: { table_name: 'entries' } })
    await module.flush_now()

    const shipped = find_sent_entry('actionable warning')
    expect(shipped?.level).toBe('warn')
  })

  test('a bare console.warn is NOT captured (deliberately not patched)', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    console.warn('uncaptured noise warning')
    await module.flush_now()

    expect(find_sent_entry('uncaptured noise warning')).toBeUndefined()
  })

  test('caps localStorage buffer at MAX_BUFFER (drops oldest)', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    for (let i = 0; i < 80; i++)
      module.log_event({ level: 'info', message: `entry-${i}` })
    await module.flush_now()

    // Across all flush calls, the last 50 entries (entry-30..entry-79) should
    // have been sent. Older entries (session_start + entry-0..entry-29) were
    // dropped when the buffer hit MAX_BUFFER=50.
    const sent_messages = new Set(all_sent_entries().map(entry => entry.message))
    expect(sent_messages.has('entry-30')).toBeTruthy()
    expect(sent_messages.has('entry-79')).toBeTruthy()
    expect(sent_messages.has('entry-29')).toBeFalsy()
    expect(sent_messages.has('session_start')).toBeFalsy()
  })

  test('emits session_start on init and stamps session_id on every entry', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    module.log_event({ level: 'error', message: 'after-start' })
    await module.flush_now()

    const start = find_sent_entry('session_start')
    const after = find_sent_entry('after-start')
    expect(start).toBeTruthy()
    expect(start?.level).toBe('info')
    expect(after).toBeTruthy()

    const start_session = (start?.context as { session_id: string }).session_id
    const after_session = (after?.context as { session_id: string }).session_id
    expect(start_session).toBeTruthy()
    expect(start_session).toBe(after_session)
  })

  test('enriches every entry with platform=web and a hostname-derived build_target', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    module.log_event({ level: 'error', message: 'enriched' })
    await module.flush_now()

    const entry = find_sent_entry('enriched')
    expect(entry?.platform).toBe('web')
    // happy-dom serves from localhost → development environment.
    expect(entry?.build_target).toBe('development')
  })

  test('two init calls produce one session (idempotent)', async () => {
    const module = await import('./remote-log')
    module.init_remote_logging()
    module.init_remote_logging()
    await module.flush_now()

    const starts = all_sent_entries().filter(entry => entry.message === 'session_start')
    expect(starts).toHaveLength(1)
  })

  test('heartbeat fires on the configured interval', async () => {
    vi.useFakeTimers()
    try {
      const module = await import('./remote-log')
      module.init_remote_logging()

      // No heartbeat yet at 15s (interval is 30s).
      vi.advanceTimersByTime(15_000)
      await module.flush_now()
      expect(all_sent_entries().filter(entry => entry.message === 'heartbeat')).toHaveLength(0)

      // First heartbeat at 30s, second at 60s.
      vi.advanceTimersByTime(45_000) // total 60s
      await module.flush_now()
      const heartbeats = all_sent_entries().filter(entry => entry.message === 'heartbeat')
      expect(heartbeats).toHaveLength(2)
      const first = heartbeats[0].context as { elapsed_seconds: number }
      const second = heartbeats[1].context as { elapsed_seconds: number }
      expect(first.elapsed_seconds).toBe(30)
      expect(second.elapsed_seconds).toBe(60)
    } finally {
      vi.useRealTimers()
    }
  })

  test('heartbeat pauses after the idle timeout and resumes on user activity', async () => {
    vi.useFakeTimers()
    try {
      const module = await import('./remote-log')
      module.init_remote_logging()

      // 6 min of zero interaction: ticks fire only through the 5-min idle window
      // (30s..300s = 10), then pause.
      vi.advanceTimersByTime(6 * 60_000)
      await module.flush_now()
      expect(all_sent_entries().filter(entry => entry.message === 'heartbeat')).toHaveLength(10)

      // A user interaction resets the idle clock — heartbeats resume.
      window.dispatchEvent(new Event('pointerdown'))
      vi.advanceTimersByTime(60_000) // two more ticks
      await module.flush_now()
      expect(all_sent_entries().filter(entry => entry.message === 'heartbeat')).toHaveLength(12)
    } finally {
      vi.useRealTimers()
    }
  })
})
