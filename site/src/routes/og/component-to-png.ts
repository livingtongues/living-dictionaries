import { render } from 'svelte/server'
import type { Component } from 'svelte'
import { create_render_pool } from './render-pool'
// Vite plugin turns this import into the result of readFileSync during build.
import NotoSans from './notoSans.ttf'
// The worker's own SOURCE, inlined as a string at build time — see render-worker.js.
import worker_source from './render-worker.js?raw'
import { record_og_event } from './og-telemetry'
import { log_server_event } from '$lib/server/log-server-event'

/**
 * Name the failure class for `og_render_failed` telemetry — the old blanket
 * `og_font_unsupported` label actively misled triage when the real fault was
 * satori failing to fetch a remote entry photo (2026-07-08 review).
 */
export function classify_og_failure(error: unknown): 'image_fetch' | 'font' | 'render' | 'worker' {
  const message = (error as { message?: unknown } | null | undefined)?.message
  if (typeof message === 'string') {
    if (/load.{0,20}image|image.{0,30}fetch failed/i.test(message))
      return 'image_fetch'
    if (/font|lookupType|substFormat|glyph|opentype/i.test(message))
      return 'font'
    if (/render worker|render timed out/i.test(message))
      return 'worker'
  }
  return 'render'
}

/**
 * satori + resvg run in a worker thread (`render-worker.js`), so a card render
 * never makes this process's event loop unreachable. Nothing here is memoized:
 * rendered cards are persisted by `card-store.ts` and looked up before this is
 * ever called — the old in-process `withCache` was an unbounded `Map` holding
 * every ~220 KB PNG for the life of the container (2.87 GiB serving vs 1.17 GiB
 * idle standby, 2026-07-27). Disk is the cache.
 */
const pool = create_render_pool({
  source: worker_source,
  worker_data: { font: Buffer.from(NotoSans), module_urls: resolve_module_urls() },
  on_event: ({ message, error, context }) => {
    if (message === 'og_render_failed')
      record_og_event({ level: 'warn', message, error, context })
    else
      log_server_event({ level: 'warn', message, error, context })
  },
})

/** The card bytes. The caller stores them and builds the response. */
export function render_component_to_png({ component, props, height, width }: {
  component: Component<any>
  props: Record<string, unknown>
  height: number
  width: number
}): Promise<Uint8Array> {
  // Svelte 5 SSR: `render(Component, { props })` replaces the removed Svelte 4
  // `Component.render(props)`. `.body` carries the markup (OpenGraphImage uses
  // inline styles, so there's no `.head` CSS to fold in); strip the hydration
  // comment markers satori-html doesn't need. Sub-millisecond, and it has to
  // happen here — the component doesn't exist as a file the worker could load.
  const result = render(component, { props })
  const markup = result.body.replace(/<!--[[\]]?-->/g, '')
  return pool.render({ markup, height, width })
}

export const render_pool_stats = pool.stats
/** Tests only — production keeps the pool for the life of the process. */
export const shutdown_render_pool = pool.shutdown

/**
 * Absolute file URLs for the renderer's packages, resolved HERE and handed to
 * the worker: eval'd worker code resolves a bare specifier against the process
 * CWD, which is an implicit contract nobody documents. `import.meta.resolve` is
 * plain Node in production; if a bundler/test runner hasn't provided it we omit
 * the entry and the worker falls back to the bare name.
 */
function resolve_module_urls(): Record<string, string> {
  const urls: Record<string, string> = {}
  for (const specifier of ['satori', 'satori-html', '@resvg/resvg-js']) {
    try {
      const resolved = import.meta.resolve?.(specifier)
      if (resolved)
        urls[specifier] = resolved
    } catch {
      // fall through to the bare specifier
    }
  }
  return urls
}

if (import.meta.vitest) {
  describe(classify_og_failure, () => {
    test('an R2 photo fetch failure is image_fetch (the 2026-07-08 mislabel)', () => {
      expect(classify_og_failure(new Error(`Can't load image https://media.livingdictionaries.app/dict/photo/id_w1600.webp: fetch failed`))).toBe('image_fetch')
    })
    test('an opentype GSUB parse failure is font', () => {
      expect(classify_og_failure(new Error('lookupType: 5 - substFormat: 3 is not yet supported'))).toBe('font')
      expect(classify_og_failure(new Error('unsupported font glyph table'))).toBe('font')
    })
    test('a dead or wedged render worker is its own class, not a mystery render fault', () => {
      expect(classify_og_failure(new Error('og render worker exited with code 1'))).toBe('worker')
      expect(classify_og_failure(new Error('og render timed out after 10000ms'))).toBe('worker')
    })
    test('anything else is render', () => {
      expect(classify_og_failure(new Error('something unexpected'))).toBe('render')
      expect(classify_og_failure(null)).toBe('render')
    })
  })
}
