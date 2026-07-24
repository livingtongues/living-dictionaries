import { beforeEach, describe, expect, test, vi } from 'vitest'
import { GET } from './+server'

const { get_log_analytics, log_server_event } = vi.hoisted(() => ({
  get_log_analytics: vi.fn(),
  log_server_event: vi.fn(),
}))

vi.mock('$lib/auth/verify', () => ({
  verify_auth: vi.fn(() => Promise.resolve({ user_id: 'admin-1', email: 'admin@example.com' })),
}))
vi.mock('$lib/admins', () => ({
  is_admin: vi.fn(() => true),
  is_admin_at_least: vi.fn(() => false),
}))
vi.mock('$lib/db/server/log-analytics', () => ({
  get_log_analytics,
  build_host_stats: vi.fn(),
}))
vi.mock('$lib/server/log-server-event', () => ({ log_server_event }))

function call(search = '') {
  return GET({
    url: new URL(`http://localhost/api/admin/analytics${search}`),
    cookies: { get: () => undefined },
  } as unknown as Parameters<typeof GET>[0])
}

describe(GET, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    get_log_analytics.mockImplementation((options) => {
      options.on_computed?.({ duration_ms: 432 })
      return { host: null }
    })
  })

  test('persists one whole-compute timing event for an uncached calculation', async () => {
    const response = await call('?audience=bots&scope=diagnostics')

    expect(response.status).toBe(200)
    expect(log_server_event).toHaveBeenCalledOnce()
    expect(log_server_event).toHaveBeenCalledWith({
      level: 'info',
      message: 'admin_analytics_computed',
      user_id: 'admin-1',
      context: {
        duration_ms: 432,
        days: 30,
        audience: 'bots',
        scope: 'diagnostics',
      },
    })
  })

  test('does not emit when get_log_analytics returns a cached value', async () => {
    get_log_analytics.mockReturnValue({ host: null })

    const response = await call('?scope=usage')

    expect(response.status).toBe(200)
    expect(log_server_event).not.toHaveBeenCalled()
  })
})
