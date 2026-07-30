import { beforeEach, describe, expect, test, vi } from 'vitest'
import { GET } from './+server'

/**
 * The contract this endpoint has to keep is NEGATIVE: it must not compute, and it
 * must not touch a database. `log-analytics` is deliberately NOT mocked here — it
 * isn't in this route's import graph any more, and if someone puts it back these
 * tests keep passing while production regains an 80 s request, so the real guard
 * is the assertion that a MISSING checkpoint returns null instead of numbers.
 */
const { read_analytics_snapshot, analytics_snapshot_running, read_deploy_metrics, read_host_stats, is_admin_at_least } = vi.hoisted(() => ({
  read_analytics_snapshot: vi.fn(),
  analytics_snapshot_running: vi.fn(() => false),
  read_deploy_metrics: vi.fn(() => [] as unknown[]),
  read_host_stats: vi.fn(() => ({ cpu_pct: 42 })),
  is_admin_at_least: vi.fn(() => false),
}))

vi.mock('$lib/auth/verify', () => ({
  verify_auth: vi.fn(() => Promise.resolve({ user_id: 'admin-1', email: 'admin@example.com' })),
}))
vi.mock('$lib/admins', () => ({ is_admin: vi.fn(() => true), is_admin_at_least }))
vi.mock('$lib/db/server/analytics-snapshot', () => ({ read_analytics_snapshot, analytics_snapshot_running }))
vi.mock('$lib/db/server/deploy-metrics', () => ({ read_deploy_metrics }))
vi.mock('$lib/server/host-stats', () => ({ read_host_stats }))

function call(search = '') {
  return GET({
    url: new URL(`http://localhost/api/admin/analytics${search}`),
    cookies: { get: () => undefined },
  } as unknown as Parameters<typeof GET>[0])
}

const snapshot = {
  format: 1,
  generated_at: '2026-07-30T10:30:00.000Z',
  computed_ms: 41_000,
  range: '30',
  audience: 'humans',
  reason: 'cron',
  payload: { audience: 'humans', window_days: 30, totals: { sessions: 3 }, host: { now: null, samples: 12, latest: null, hourly: [] } },
}

describe(GET, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    analytics_snapshot_running.mockReturnValue(false)
    read_deploy_metrics.mockReturnValue([])
    read_host_stats.mockReturnValue({ cpu_pct: 42 })
    is_admin_at_least.mockReturnValue(false)
    read_analytics_snapshot.mockReturnValue(snapshot)
  })

  test('serves the checkpoint payload with its staleness stamp', async () => {
    const response = await call()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(read_analytics_snapshot).toHaveBeenCalledWith({ range: '30', audience: 'humans' })
    expect(body.analytics.totals).toEqual({ sessions: 3 })
    expect(body.checkpoint).toEqual({ generated_at: '2026-07-30T10:30:00.000Z', computed_ms: 41_000, reason: 'cron', running: false })
  })

  test('reads the bots audience from the query — another precomputed file, never a compute', async () => {
    await call('?audience=bots')
    expect(read_analytics_snapshot).toHaveBeenCalledWith({ range: '30', audience: 'bots' })
  })

  test('a missing checkpoint is null (the page shows its empty state), not a compute', async () => {
    read_analytics_snapshot.mockReturnValue(null)

    const response = await call()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.analytics).toBe(null)
    expect(body.checkpoint.generated_at).toBe(null)
  })

  test('level-3 gets host + deploys, with `now` overwritten by a LIVE /proc read', async () => {
    is_admin_at_least.mockReturnValue(true)
    read_deploy_metrics.mockReturnValue([{ outcome: 'ok' }])

    const body = await (await call()).json()

    // The logged half rides the checkpoint; only `now` is fresh — and that's a
    // /proc read, not a query.
    expect(body.analytics.host).toEqual({ now: { cpu_pct: 42 }, samples: 12, latest: null, hourly: [] })
    expect(body.analytics.deploy_metrics).toEqual([{ outcome: 'ok' }])
  })

  test('below level-3 sees no host resources and no deploy history', async () => {
    const body = await (await call()).json()

    expect(body.analytics.host).toBe(null)
    expect(body.analytics.deploy_metrics).toEqual([])
    expect(read_host_stats).not.toHaveBeenCalled()
  })

  test('surfaces a running child so the page can say "Computing…"', async () => {
    analytics_snapshot_running.mockReturnValue(true)

    const body = await (await call()).json()

    expect(body.checkpoint.running).toBeTruthy()
  })
})
