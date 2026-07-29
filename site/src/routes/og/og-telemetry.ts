import type { ClientLogLevel } from '$lib/db/schemas/shared.types'
import { log_server_event } from '$lib/server/log-server-event'

interface OgEvent {
  level: ClientLogLevel
  message: 'og_card_rendered' | 'og_render_failed' | 'og_render_shed'
  error?: unknown
  context?: Record<string, unknown>
}

interface Bucket {
  event: OgEvent
  count: number
  render_ms_total: number
  render_ms_max: number
  wait_ms_max: number
  photos: number
}

const WINDOW_MS = 60_000

export function create_og_telemetry({ emit = log_server_event, window_ms = WINDOW_MS }: {
  emit?: typeof log_server_event
  window_ms?: number
} = {}) {
  const buckets = new Map<string, Bucket>()
  let timer: ReturnType<typeof setTimeout> | null = null

  function schedule_flush() {
    if (timer)
      return
    timer = setTimeout(flush, window_ms)
    timer.unref?.()
  }

  function flush() {
    if (timer)
      clearTimeout(timer)
    timer = null
    for (const bucket of buckets.values()) {
      const { event, count, render_ms_total, render_ms_max, wait_ms_max, photos } = bucket
      emit({
        ...event,
        context: {
          ...event.context,
          aggregated: true,
          count,
          ...(render_ms_total > 0
            ? {
                render_ms_avg: Math.round(render_ms_total / count),
                render_ms_max,
                photos,
              }
            : {}),
          ...(wait_ms_max > 0 ? { wait_ms_max } : {}),
        },
      })
    }
    buckets.clear()
  }

  function record(event: OgEvent) {
    const context = event.context ?? {}
    const key = [
      event.message,
      context.reason,
      context.reason_source,
      context.retry,
      context.fallback,
      context.last_shed,
    ].join('|')
    const bucket = buckets.get(key) ?? {
      event,
      count: 0,
      render_ms_total: 0,
      render_ms_max: 0,
      wait_ms_max: 0,
      photos: 0,
    }
    bucket.count++
    if (typeof context.render_ms === 'number') {
      bucket.render_ms_total += context.render_ms
      bucket.render_ms_max = Math.max(bucket.render_ms_max, context.render_ms)
    }
    if (typeof context.wait_ms === 'number')
      bucket.wait_ms_max = Math.max(bucket.wait_ms_max, context.wait_ms)
    if (context.photo === true)
      bucket.photos++
    buckets.set(key, bucket)
    schedule_flush()
  }

  return { record, flush }
}

const telemetry = create_og_telemetry()

export const record_og_event = telemetry.record

if (import.meta.vitest) {
  test('coalesces one minute of repeated events while preserving useful maxima and a sample error', () => {
    vi.useFakeTimers()
    const emitted: Parameters<typeof log_server_event>[0][] = []
    const reporter = create_og_telemetry({ emit: event => emitted.push(event), window_ms: 1000 })
    const error = new Error('sample failure')

    reporter.record({ level: 'warn', message: 'og_render_shed', context: { last_shed: 'queue_full', wait_ms: 0, waiting: 12 } })
    reporter.record({ level: 'warn', message: 'og_render_shed', context: { last_shed: 'queue_full', wait_ms: 80, waiting: 12 } })
    reporter.record({ level: 'warn', message: 'og_render_failed', error, context: { reason: 'font', retry: 'static_fonts_only' } })
    vi.advanceTimersByTime(1000)

    expect(emitted).toHaveLength(2)
    expect(emitted[0].context).toMatchObject({ aggregated: true, count: 2, wait_ms_max: 80 })
    expect(emitted[1]).toMatchObject({ error, context: { aggregated: true, count: 1 } })
    vi.useRealTimers()
  })

  test('summarizes successful render duration and photo count', () => {
    const emitted: Parameters<typeof log_server_event>[0][] = []
    const reporter = create_og_telemetry({ emit: event => emitted.push(event) })
    reporter.record({ level: 'info', message: 'og_card_rendered', context: { render_ms: 400, wait_ms: 25, photo: true } })
    reporter.record({ level: 'info', message: 'og_card_rendered', context: { render_ms: 800, wait_ms: 10, photo: false } })
    reporter.flush()

    expect(emitted[0].context).toMatchObject({
      aggregated: true,
      count: 2,
      render_ms_avg: 600,
      render_ms_max: 800,
      wait_ms_max: 25,
      photos: 1,
    })
  })
}
