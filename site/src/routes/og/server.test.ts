import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { card_key, read_card, save_card } from './card-store'
import { GENERIC_CARD_KEY } from './generic-card'
import { compressToEncodedURIComponent as encode } from '$lib/lz/lz-string'

/**
 * The `/og` endpoint's SHAPE, which is what took the site down on 2026-07-27:
 * a card must be rendered ONCE, one render may run at a time, and a burst past
 * that must cost zero CPU rather than pile onto the single Node thread.
 *
 * The renderer itself is stubbed — satori/resvg are exercised by their own
 * chain (and measured against a production build); what needs guarding here is
 * that the route never renders a card it already has, and never renders more
 * than one at a time.
 */

interface RenderCall { at: number, width: number, height: number, props: Record<string, unknown> }

const renderer = {
  /** Every call the route made into the renderer — the point is that there are FEW. */
  calls: [] as RenderCall[],
  concurrent: 0,
  peak_concurrent: 0,
  delay_ms: 0,
  fail: false,
}

vi.mock('./component-to-png', async (import_original) => {
  const actual = await import_original<typeof import('./component-to-png')>()
  return {
    ...actual,
    async render_component_to_png({ width, height, props }: { width: number, height: number, props: Record<string, unknown> }) {
      renderer.calls.push({ at: Date.now(), width, height, props })
      renderer.concurrent++
      renderer.peak_concurrent = Math.max(renderer.peak_concurrent, renderer.concurrent)
      try {
        if (renderer.delay_ms)
          await new Promise(resolve => setTimeout(resolve, renderer.delay_ms))
        if (renderer.fail)
          throw new Error(`Can't load image https://media.example/photo.webp: fetch failed`)
        return Buffer.from(`fake-png-${width}`)
      } finally {
        renderer.concurrent--
      }
    },
  }
})

// The card store resolves DATA_DIR per call, so it must be set before the first save.
let data_dir: string
let previous_data_dir: string | undefined

beforeEach(() => {
  previous_data_dir = process.env.DATA_DIR
  data_dir = mkdtempSync(join(tmpdir(), 'ld-og-endpoint-'))
  process.env.DATA_DIR = data_dir
  // Seed the spare tyre so the once-per-process background warm never fires here:
  // it is a `setTimeout` render that lands at an unpredictable moment and would
  // add a phantom call to every count below (it did, under a loaded test run).
  // The one test that cares about the warm clears this first.
  save_card({ key: GENERIC_CARD_KEY, png: Buffer.from('seeded-generic') })
  renderer.calls = []
  renderer.concurrent = 0
  renderer.peak_concurrent = 0
  renderer.delay_ms = 0
  renderer.fail = false
})

afterEach(() => {
  if (previous_data_dir === undefined)
    delete process.env.DATA_DIR
  else
    process.env.DATA_DIR = previous_data_dir
  rmSync(data_dir, { recursive: true, force: true })
})

const { GET } = await import('./+server')

function props_param(props: Record<string, unknown>): string {
  return encode(JSON.stringify(props))
}

function card_url(props: Record<string, unknown>, version = '6'): string {
  return `http://localhost/og?props=${props_param(props)}&v=${version}`
}

/**
 * Where a given card lands in the store — asserted directly, so the generic card
 * can't be miscounted. Keyed off the PARSED url like the route does: lz-string's
 * URI alphabet includes `+`, which `searchParams` reads back as a space.
 */
function key_for(props: Record<string, unknown>, version = '6'): string {
  const url = new URL(card_url(props, version))
  return card_key({ props_param: url.searchParams.get('props'), image_version: url.searchParams.get('v') })
}

function get(url: string) {
  return GET({ url: new URL(url) } as unknown as Parameters<typeof GET>[0])
}

const CARD = { width: 1200, height: 630, title: 'Sunflower', dictionaryName: 'Tutelo-Saponi' }

describe('GET /og — render once, store, serve', () => {
  test('a cold card renders once and is served immutable', async () => {
    const response = await get(card_url(CARD))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('cache-control')).toContain('immutable')
    expect(renderer.calls).toHaveLength(1)
    expect(read_card(key_for(CARD))).toEqual(Buffer.from('fake-png-1200'))
  })

  test('THE FIX: the same card is never rendered twice — a crawler burst costs a file read', async () => {
    const url = card_url(CARD)
    const first = Buffer.from(await (await get(url)).arrayBuffer())
    expect(renderer.calls).toHaveLength(1)

    // The five-minute crawler cycle: same URL, ten more times.
    for (let i = 0; i < 10; i++) {
      const response = await get(url)
      expect(Buffer.from(await response.arrayBuffer())).toEqual(first)
      expect(response.headers.get('cache-control')).toContain('immutable')
    }
    expect(renderer.calls).toHaveLength(1)
  })

  test('a different card, and a bumped OG_IMAGE_VERSION, each render their own', async () => {
    await get(card_url(CARD))
    await get(card_url({ ...CARD, title: 'Moon' }))
    await get(card_url(CARD, '7'))
    expect(renderer.calls).toHaveLength(3)
  })

  test('a stored card survives a process restart (it is on disk, not in a Map)', async () => {
    await get(card_url(CARD))
    vi.resetModules()
    const { GET: fresh_get } = await import('./+server')
    const response = await fresh_get({ url: new URL(card_url(CARD)) } as unknown as Parameters<typeof GET>[0])
    expect(response.headers.get('cache-control')).toContain('immutable')
    expect(renderer.calls).toHaveLength(1)
  })
})

describe('GET /og — bounded concurrency', () => {
  test('THE FIX: eight simultaneous distinct cards never render more than one at a time', async () => {
    renderer.delay_ms = 30
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, i) => get(card_url({ ...CARD, title: `Card ${i}` }))),
    )
    expect(renderer.peak_concurrent).toBe(1)
    // Nobody gets an error — a scraper always gets a PNG.
    for (const response of responses) {
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/png')
    }
  })

  test('a burst past the queue cap is SHED with a short TTL, not queued without bound', async () => {
    // Long enough that the 2 s wait deadline can't drain a 40-deep burst.
    renderer.delay_ms = 300
    const responses = await Promise.all(
      Array.from({ length: 40 }, (_, i) => get(card_url({ ...CARD, title: `Burst ${i}` }))),
    )
    const shed = responses.filter(response => !response.headers.get('cache-control').includes('immutable'))
    // eslint-disable-next-line no-restricted-syntax -- how many get shed depends on real elapsed time
    expect(shed.length).toBeGreaterThan(0)
    // A shed card must expire quickly so the scraper comes back for the real one.
    for (const response of shed) {
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toContain('max-age=60')
    }
    // And the work actually done stayed bounded — nothing like 40 renders.
    // eslint-disable-next-line no-restricted-syntax -- same: a wall-clock-bounded count
    expect(renderer.calls.length).toBeLessThan(40)
    expect(renderer.peak_concurrent).toBe(1)
  })
})

describe('GET /og — the shed card is a real card, not a transparent pixel', () => {
  test('the generic card is warmed once while idle, and answers a shed request', async () => {
    // This test wants the warm to actually happen — drop the seed from beforeEach.
    rmSync(join(data_dir, 'og-cache', `${GENERIC_CARD_KEY}.png`))
    // A FRESH module: the once-per-process warm flag lives in module scope.
    vi.resetModules()
    const { GET: fresh_get } = await import('./+server')
    const fresh = (url: string) => fresh_get({ url: new URL(url) } as unknown as Parameters<typeof GET>[0])

    // The first request warms the spare tyre in the background, off its own path.
    await fresh(card_url(CARD))
    await vi.waitFor(() => expect(read_card(GENERIC_CARD_KEY)).toBeTruthy())
    expect(renderer.calls).toHaveLength(2) // the card itself + the generic fallback

    renderer.delay_ms = 300
    const responses = await Promise.all(
      Array.from({ length: 40 }, (_, i) => fresh(card_url({ ...CARD, title: `Shed ${i}` }))),
    )
    const shed = responses.filter(response => !response.headers.get('cache-control').includes('immutable'))
    // eslint-disable-next-line no-restricted-syntax -- wall-clock-dependent count
    expect(shed.length).toBeGreaterThan(0)
    const body = Buffer.from(await shed[0].arrayBuffer())
    // The stubbed renderer's bytes — i.e. the STORED generic card, not the 1×1.
    expect(body.toString()).toBe('fake-png-1200')
  })
})

describe('GET /og — a URL cannot ask for an unbounded drawing', () => {
  test('THE FIX: a 20,000×20,000 request is clamped before it reaches the renderer', async () => {
    const response = await get(card_url({ ...CARD, width: 20_000, height: 20_000 }))
    expect(response.status).toBe(200)
    expect(renderer.calls[0].width).toBe(2400)
    expect(renderer.calls[0].height).toBe(2400)
  })

  test('the clamped size is written back into the props the card draws with', async () => {
    await get(card_url({ ...CARD, width: 20_000, height: 20_000 }))
    // Otherwise the viewport is 2400px and the photo inside it is 20,000px.
    expect(renderer.calls[0].props.width).toBe(2400)
    expect(renderer.calls[0].props.height).toBe(2400)
  })

  test('a missing or nonsense size still draws the real 1200×630 card', async () => {
    const { width: _w, height: _h, ...sizeless } = CARD
    await get(card_url(sizeless))
    await get(card_url({ ...CARD, width: 0, height: -4, title: 'Zero' }))
    for (const call of renderer.calls) {
      expect(call.width).toBe(1200)
      expect(call.height).toBe(630)
    }
  })
})

describe('GET /og — a URL cannot make this server fetch an arbitrary host', () => {
  test('THE FIX: a foreign photo host is dropped, and the card renders without it', async () => {
    const fetch_spy = vi.spyOn(globalThis, 'fetch')
    const response = await get(card_url({ ...CARD, image_url: 'http://169.254.169.254/latest/meta-data/' }))
    expect(response.status).toBe(200)
    expect(fetch_spy).not.toHaveBeenCalled()
    expect(renderer.calls[0].props.image_url).toBe(undefined)
    fetch_spy.mockRestore()
  })
})

describe('GET /og — degrading', () => {
  test('undecodable props still produce a generic card rather than a 500', async () => {
    const response = await get('http://localhost/og?props=not-lz-compressed')
    expect(response.status).toBe(200)
    expect(renderer.calls).toHaveLength(1)
  })

  test('a render failure falls back to the text-only card, and THAT is stored', async () => {
    renderer.fail = true
    const failing_card = { ...CARD, image_url: 'https://media.example/photo.jpg' }
    const response = await get(card_url(failing_card))
    expect(renderer.calls).toHaveLength(2) // photo card, then text-only — both stubbed to fail
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('max-age=60')
    // A blank card must never become this URL's permanent answer.
    expect(read_card(key_for(failing_card))).toBe(null)
  })
})
