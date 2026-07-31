import { Worker } from 'node:worker_threads'
import { mkdir, writeFile } from 'node:fs/promises'
import { render } from 'svelte/server'
import type { Component } from 'svelte'
import { render_component_to_png, render_pool_stats, shutdown_render_pool } from './component-to-png'
import NotoSans from './notoSans.ttf'
import Cairo from './cairo.ttf'
import worker_source from './render-worker.js?raw'
import OpenGraphImage from './OpenGraphImage.svelte'

/**
 * The pool reports its non-fatal notes (a font it couldn't map, a font CDN that
 * answered 500) through `record_og_event` — intercepting it is how a test reads
 * what the worker said, without giving production code a test-only channel.
 */
const logged: { message: string, context?: Record<string, unknown> | null }[] = []
vi.mock('./og-telemetry', () => ({
  record_og_event: (event: { message: string, context?: Record<string, unknown> | null }) => {
    logged.push(event)
  },
}))

/**
 * The real chain — svelte SSR → satori → resvg → PNG — through the real worker,
 * which is the only way to prove the two things that matter about it:
 *
 *  1. it still produces a correct card, and
 *  2. it does NOT make this thread's event loop unreachable while doing so.
 *
 * (2) is the entire point of the worker (2026-07-27 outage: an in-process render
 * pushed `/healthz` to 3,251 ms past Caddy's 2 s health timeout and took the site
 * down). A regression here would be silent in every other test — a card renders
 * exactly the same whether or not it blocks the thread it renders on.
 */

const WIDTH = 1200
const HEIGHT = 630

const CARD_PROPS = {
  title: 'Sunflower',
  description: 'A tall plant with a large yellow flower head',
  dictionaryName: 'Tutelo-Saponi',
  height: HEIGHT,
  width: WIDTH,
}

afterAll(() => shutdown_render_pool())

function png_size(png: Uint8Array): { width: number, height: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  // IHDR is the first chunk: 8-byte signature, 4-byte length, 4-byte type, then w/h.
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4E, 0x47])

function signature_of(png: Uint8Array): Uint8Array {
  return png.slice(0, 4)
}

/**
 * The longest the event loop went unserviced while `work` ran — i.e. how long a
 * `/healthz` landing at the worst moment would have waited.
 */
async function measure_loop_stall<T>(work: () => Promise<T>): Promise<{ result: T, elapsed_ms: number, worst_stall_ms: number }> {
  let worst_stall_ms = 0
  let last_tick = Date.now()
  const ticker = setInterval(() => {
    const now = Date.now()
    worst_stall_ms = Math.max(worst_stall_ms, now - last_tick)
    last_tick = now
  }, 5)
  const started_at = Date.now()
  try {
    const result = await work()
    return { result, elapsed_ms: Date.now() - started_at, worst_stall_ms }
  } finally {
    clearInterval(ticker)
  }
}

/**
 * One card through a throwaway worker with a font map of the test's choosing —
 * the only way to exercise a font that misbehaves without shipping one.
 */
async function render_with_font_map({ title, language_font_map, cairo_font }: { title: string, language_font_map: Record<string, string[]>, cairo_font?: ArrayBuffer }): Promise<Uint8Array> {
  const markup = render(OpenGraphImage as Component<any>, { props: { ...CARD_PROPS, title } }).body.replace(/<!--[[\]]?-->/g, '')
  const module_urls: Record<string, string> = {}
  for (const specifier of ['satori', 'satori-html', '@resvg/resvg-js'])
    module_urls[specifier] = import.meta.resolve(specifier)

  const worker = new Worker(worker_source, { eval: true, workerData: { font: Buffer.from(NotoSans as unknown as ArrayBuffer), cairo_font: cairo_font ? Buffer.from(cairo_font) : undefined, module_urls, language_font_map } })
  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      worker.on('message', (message) => {
        if (message.type === 'done')
          resolve(message.png)
        if (message.type === 'failed')
          reject(new Error(message.message))
      })
      worker.on('error', reject)
      worker.postMessage({ id: 1, markup, height: HEIGHT, width: WIDTH })
    })
  } finally {
    await worker.terminate()
  }
}

describe('the share-card renderer, off the request thread', () => {
  test('bundled Cairo renders Arabic glyphs instead of tofu without a network fallback', async () => {
    const title = 'šäš شش'
    const language_font_map = { 'ar-AR': [], 'unknown': [] }
    const [cairo_png, tofu_png] = await Promise.all([
      render_with_font_map({ title, language_font_map, cairo_font: Cairo as unknown as ArrayBuffer }),
      render_with_font_map({ title, language_font_map }),
    ])

    await mkdir('/tmp/og-cards', { recursive: true })
    await Promise.all([
      writeFile('/tmp/og-cards/arabic-cairo.png', cairo_png),
      writeFile('/tmp/og-cards/arabic-tofu.png', tofu_png),
    ])

    expect(signature_of(cairo_png)).toEqual(PNG_SIGNATURE)
    expect(cairo_png).not.toEqual(tofu_png)
  }, 60_000)

  test('a multi-script headword asks for a MAPPED font for every script it contains', async () => {
    // satori renamed every script code between 0.0.44 and 0.26+; this repo made
    // that jump on 2026-07-31. `font-map.ts` proves the map's keys against the
    // installed satori; this proves the WORKER's copy of the lookup (which
    // cannot import that file) agrees — including the `|`-joined codes satori
    // emits for Han. Hebrew + Greek + Han + emoji in one string, which only
    // resolves because the loader hands satori ALL the matching families and it
    // falls back per glyph.
    //
    // Asserts on `font_unmapped` ONLY, never on a fetch outcome: this must not
    // start failing because Google Fonts was slow on somebody's laptop.
    logged.length = 0
    const png = await render_component_to_png({
      component: OpenGraphImage,
      props: { ...CARD_PROPS, title: 'מַלְאָך λόγος 聖書 🔥' },
      height: HEIGHT,
      width: WIDTH,
    })
    expect(signature_of(png)).toEqual(PNG_SIGNATURE)
    expect(logged.filter(event => event.context?.reason === 'font_unmapped')).toEqual([])
  }, 60_000)

  test('a font whose tables break the parser costs the GLYPHS, not the card', async () => {
    // The `static_fonts_only` retry never actually ran with static fonts only:
    // satori caches its FontLoader in a WeakMap keyed by the IDENTITY of
    // `options.fonts`, and this worker reused one array, so the retry
    // re-rendered against the loader that had just been handed the font that
    // threw. That is why the 1,486 daily font failures from one Arabic-script
    // dictionary (2026-07-29 review) were GENERIC cards, not tofu ones.
    //
    // The reproducer is Arabic TEXT in a Noto Arabic face: every one of them
    // throws `lookupType: 5 - substFormat: 3 is not yet supported` in
    // `@shuding/opentype.js` while shaping required ligatures. The map is passed
    // explicitly so this keeps reproducing whatever `font-map.ts` says today.
    const png = await render_with_font_map({
      title: 'العربية',
      language_font_map: { 'ar-AR': ['Noto+Sans+Arabic'], 'unknown': ['Noto+Sans'] },
    })
    expect(signature_of(png)).toEqual(PNG_SIGNATURE)
  }, 60_000)

  test('THE FIX: a real 1200×630 card renders WITHOUT blocking this thread', async () => {
    const { result: png, elapsed_ms, worst_stall_ms } = await measure_loop_stall(() =>
      render_component_to_png({ component: OpenGraphImage, props: { ...CARD_PROPS }, height: HEIGHT, width: WIDTH }))

    expect(signature_of(png)).toEqual(PNG_SIGNATURE)
    expect(png_size(png)).toEqual({ width: WIDTH, height: HEIGHT })

    // In-process, the whole render (~800 ms in production, and the first one here
    // also pays worker spawn + satori's module load) was ONE unbroken stall. A
    // health check has 2 s; 250 ms of slack against a multi-second render is the
    // difference between "waits behind a card" and "never notices one".
    // eslint-disable-next-line no-restricted-syntax -- a wall-clock ceiling, not an equality
    expect(worst_stall_ms).toBeLessThan(250)
    // eslint-disable-next-line no-restricted-syntax -- ditto: the render must be the SLOW part
    expect(elapsed_ms).toBeGreaterThan(worst_stall_ms)
  }, 60_000)

  test('the second card reuses the same worker — spawning is not per-render', async () => {
    const spawns_before = render_pool_stats().spawns
    const png = await render_component_to_png({ component: OpenGraphImage, props: { ...CARD_PROPS, title: 'Moon' }, height: HEIGHT, width: WIDTH })
    expect(signature_of(png)).toEqual(PNG_SIGNATURE)
    expect(render_pool_stats().spawns).toBe(spawns_before)
  }, 60_000)

  test('concurrent callers are serialized inside the worker so native Resvg references never overlap', async () => {
    const cards = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      render_component_to_png({
        component: OpenGraphImage,
        props: { ...CARD_PROPS, title: `Concurrent ${index}` },
        height: HEIGHT,
        width: WIDTH,
      })))

    expect(cards).toHaveLength(8)
    for (const png of cards)
      expect(signature_of(png)).toEqual(PNG_SIGNATURE)
  }, 120_000)
})
