import { render_component_to_png, render_pool_stats, shutdown_render_pool } from './component-to-png'
import OpenGraphImage from './OpenGraphImage.svelte'

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

describe('the share-card renderer, off the request thread', () => {
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
