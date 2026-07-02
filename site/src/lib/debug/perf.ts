import { track_timing, track_web_vital } from './remote-log'

/**
 * Page-load + Web-Vitals reporting. Companion to `remote-log.ts` — kept separate
 * so the (dynamically imported) `web-vitals` dependency stays out of the
 * critical logging path. Browser-only; every entry point no-ops off-browser or
 * when the underlying APIs are missing, and never throws.
 */

let initial_load_reported = false
let web_vitals_started = false

/**
 * Read the Navigation Timing API for the initial/hard load and emit a single
 * `page_load` perf event (TTFB incl. SSR render → DOMContentLoaded → load). This
 * is the only window into server-render + first-paint cost; client-side SPA navs
 * are measured separately via `beforeNavigate`/`afterNavigate`.
 */
export function report_initial_load(): void {
  try {
    if (initial_load_reported)
      return
    if (typeof performance === 'undefined' || !performance.getEntriesByType)
      return
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (!entry)
      return
    // A tab opened/loaded in the background inflates loadEventEnd with throttled
    // background time — not the user-perceived load. Skip the timing when hidden
    // so the page_load distribution stays honest (mirrors the content_ready guard).
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden')
      return
    initial_load_reported = true
    track_timing({
      name: 'page_load',
      duration_ms: entry.duration,
      context: {
        ttfb: Math.round(entry.responseStart),
        dom_interactive: Math.round(entry.domInteractive),
        dom_content_loaded: Math.round(entry.domContentLoadedEventEnd),
        load_complete: Math.round(entry.loadEventEnd),
        nav_type: entry.type ?? null,
      },
    })
  } catch {
    // Never let perf reporting break the app.
  }
}

/**
 * Call from `onMount`. Reports the initial load once the `load` event has fired
 * (so `loadEventEnd` is populated) — immediately if the page is already loaded.
 */
export function report_initial_load_when_ready(): void {
  try {
    if (typeof document === 'undefined')
      return
    if (document.readyState === 'complete') {
      report_initial_load()
      return
    }
    window.addEventListener('load', () => report_initial_load(), { once: true })
  } catch {
    // ignore
  }
}

/**
 * Wire the Web Vitals (LCP / INP / CLS / FCP / TTFB) to the `perf` channel.
 * Dynamically imports `web-vitals` so it never blocks first paint. Each metric
 * reports once finalized (LCP/INP/CLS on interaction or page-hide), so a session
 * with no interaction may only yield TTFB/FCP — that's expected. Idempotent.
 */
export function init_web_vitals(): void {
  if (web_vitals_started)
    return
  if (typeof window === 'undefined')
    return
  web_vitals_started = true
  void import('web-vitals')
    .then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
      const report = (metric: { name: string, value: number, rating?: string, navigationType?: string }) => {
        track_web_vital({
          metric: metric.name,
          value: metric.value,
          rating: metric.rating,
          navigation_type: metric.navigationType,
        })
      }
      onCLS(report)
      onINP(report)
      onLCP(report)
      onFCP(report)
      onTTFB(report)
    })
    .catch(() => {
      web_vitals_started = false
    })
}

/** Test-only: reset module guards so a clean test can re-run. */
export function _reset_perf_for_tests(): void {
  initial_load_reported = false
  web_vitals_started = false
}
