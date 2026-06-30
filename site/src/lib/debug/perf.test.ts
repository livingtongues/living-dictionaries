/**
 * @vitest-environment happy-dom
 *
 * Initial-load Navigation Timing + Web-Vitals wiring. Needs DOM globals
 * (`performance`, `document`, `window`) so it runs on happy-dom.
 */

// Capture what perf.ts ships without going through the network buffer.
const track_timing_mock = vi.hoisted(() => vi.fn())
const track_web_vital_mock = vi.hoisted(() => vi.fn())
vi.mock('./remote-log', () => ({
  track_timing: track_timing_mock,
  track_web_vital: track_web_vital_mock,
}))

// Controllable web-vitals doubles — each on* handler records its callback so the
// test can fire a synthetic metric.
const handlers: Record<string, (metric: unknown) => void> = {}
vi.mock('web-vitals', () => ({
  onCLS: (cb: (m: unknown) => void) => { handlers.CLS = cb },
  onINP: (cb: (m: unknown) => void) => { handlers.INP = cb },
  onLCP: (cb: (m: unknown) => void) => { handlers.LCP = cb },
  onFCP: (cb: (m: unknown) => void) => { handlers.FCP = cb },
  onTTFB: (cb: (m: unknown) => void) => { handlers.TTFB = cb },
}))

beforeEach(async () => {
  track_timing_mock.mockReset()
  track_web_vital_mock.mockReset()
  for (const key of Object.keys(handlers)) delete handlers[key]
  const module = await import('./perf')
  module._reset_perf_for_tests()
})

function stub_navigation_entry(entry: Partial<PerformanceNavigationTiming>): void {
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([entry] as unknown as PerformanceNavigationTiming[])
}

describe('perf — initial load', () => {
  test('emits a page_load perf timing with the navigation-timing breakdown', async () => {
    stub_navigation_entry({
      duration: 1800.4,
      responseStart: 120.2,
      domInteractive: 900.9,
      domContentLoadedEventEnd: 950.1,
      loadEventEnd: 1800.4,
      type: 'navigate',
    })
    const module = await import('./perf')
    module.report_initial_load()

    expect(track_timing_mock).toHaveBeenCalledTimes(1)
    const [arg] = track_timing_mock.mock.lastCall ?? []
    expect(arg.name).toBe('page_load')
    expect(arg.duration_ms).toBe(1800.4)
    expect(arg.context).toMatchObject({ ttfb: 120, dom_content_loaded: 950, load_complete: 1800, nav_type: 'navigate' })
  })

  test('reports at most once even if called twice', async () => {
    stub_navigation_entry({ duration: 100, responseStart: 10, domInteractive: 20, domContentLoadedEventEnd: 30, loadEventEnd: 100, type: 'navigate' })
    const module = await import('./perf')
    module.report_initial_load()
    module.report_initial_load()
    expect(track_timing_mock).toHaveBeenCalledTimes(1)
  })

  test('no-ops when there is no navigation entry', async () => {
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([] as unknown as PerformanceNavigationTiming[])
    const module = await import('./perf')
    module.report_initial_load()
    expect(track_timing_mock).not.toHaveBeenCalled()
  })
})

describe('perf — web vitals', () => {
  test('wires every metric and forwards a finalized value to track_web_vital', async () => {
    const module = await import('./perf')
    module.init_web_vitals()
    // init dynamically imports web-vitals — poll until every handler registers.
    await vi.waitFor(() => expect(Object.keys(handlers)).toHaveLength(5))

    expect(Object.keys(handlers).sort()).toEqual(['CLS', 'FCP', 'INP', 'LCP', 'TTFB'])

    handlers.LCP?.({ name: 'LCP', value: 2500.4, rating: 'good', navigationType: 'navigate' })
    expect(track_web_vital_mock).toHaveBeenCalledWith({ metric: 'LCP', value: 2500.4, rating: 'good', navigation_type: 'navigate' })
  })
})
