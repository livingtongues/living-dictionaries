import sharp from 'sharp'
import { log_server_event } from '$lib/server/log-server-event'

/**
 * Make the share-card photo decodable by the OG rendering chain.
 *
 * WHY (2026-07-26 log review): the 2026-07-23 photo→R2 migration made every
 * photo variant **WebP**, and the card renderer cannot read WebP — 111 failed
 * renders in 24h, every social share of a page with a photo silently degraded
 * to a text-only card for three days.
 *
 * The chain is satori → `@resvg/resvg-js`. satori only writes an
 * `<image href="…">` into an SVG; **resvg** is what actually rasterizes it, and
 * resvg-js 2.6.2 (the newest release, measured 2026-07-27) still decodes only
 * PNG/JPEG/GIF/SVG. Upgrading satori is therefore NOT a fix — a modern satori
 * merely stops throwing and emits a card with an invisible photo, which is the
 * same outcome with no telemetry. So the bytes have to be converted here.
 *
 * Anything already decodable is passed through untouched (no fetch, no CPU);
 * anything else — today WebP, tomorrow AVIF/HEIC — is fetched once and handed
 * to satori as a JPEG data URI, which also gives the fetch a timeout satori's
 * own internal fetch does not have. Any failure returns `null`, and the caller
 * renders the existing photo-less card rather than a broken one.
 */

/** Extensions the satori → resvg chain rasterizes. Everything else needs transcoding. */
const DECODABLE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'svg'])

const JPEG_QUALITY = 80
const FETCH_TIMEOUT_MS = 6000
/** Refuse absurd downloads — a card photo has no business being bigger than this. */
const MAX_SOURCE_BYTES = 20_000_000
/** Transcoded data URIs, keyed by source URL (~200 KB each). */
const MEMO_LIMIT = 25

export function is_decodable_by_card_renderer(image_url: string): boolean {
  const [path] = image_url.split('?')[0].split('#')
  const last_segment = path.slice(path.lastIndexOf('/') + 1)
  if (!last_segment.includes('.'))
    return false // extensionless (an R2 original key, a signed URL) — transcode to be sure
  const extension = last_segment.slice(last_segment.lastIndexOf('.') + 1).toLowerCase()
  return DECODABLE_EXTENSIONS.has(extension)
}

/**
 * A photo the card can draw. `width`/`height` carry the image's pixel size and
 * are only set for a transcoded image — satori 0.0.44 can measure a file it
 * fetched but NOT a data URI ("Image size cannot be determined"), so the card
 * has to render them as `<img width height>` attributes. A transcode also crops
 * to the card's exact aspect ratio, so those attributes make the photo fill the
 * card without relying on satori's `object-fit` handling.
 */
export interface CardImage {
  url: string
  width?: number
  height?: number
}

const memo = new Map<string, CardImage>()

/**
 * Returns a photo the card renderer can draw, or `null` when the photo can't be
 * obtained (the caller then renders the card without it).
 */
export async function card_image({ image_url, width, height }: {
  image_url: string
  /** The card's pixel size — a transcoded photo is cover-cropped to exactly this. */
  width: number
  height: number
}): Promise<CardImage | null> {
  if (is_decodable_by_card_renderer(image_url))
    return { url: image_url }

  const key = `${width}x${height}|${image_url}`
  const memoized = memo.get(key)
  if (memoized)
    return memoized

  try {
    const transcoded = await transcode_to_jpeg_data_uri({ image_url, width, height })
    if (memo.size >= MEMO_LIMIT)
      memo.delete(memo.keys().next().value)
    memo.set(key, transcoded)
    return transcoded
  } catch (error) {
    log_server_event({ level: 'warn', message: 'og_image_transcode_failed', error, context: { image_url } })
    return null
  }
}

async function transcode_to_jpeg_data_uri({ image_url, width, height }: { image_url: string, width: number, height: number }): Promise<CardImage> {
  const response = await fetch(image_url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!response.ok)
    throw new Error(`card image fetch returned ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > MAX_SOURCE_BYTES)
    throw new Error(`card image is ${bytes.byteLength} bytes`)
  const { data, info } = await sharp(bytes)
    .rotate() // apply EXIF orientation before it is stripped
    .resize({ width, height, fit: 'cover' })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer({ resolveWithObject: true })
  return { url: `data:image/jpeg;base64,${data.toString('base64')}`, width: info.width, height: info.height }
}

if (import.meta.vitest) {
  describe(is_decodable_by_card_renderer, () => {
    test('the WebP variant that broke every share card on 2026-07-23 is NOT decodable', () => {
      expect(is_decodable_by_card_renderer('https://media.livingdictionaries.app/tutelo-saponi/photo/f648f1ee_w1600.webp')).toBe(false)
    })
    test('legacy JPEG/PNG originals pass straight through', () => {
      expect(is_decodable_by_card_renderer('https://media.livingdictionaries.app/dict/photo/abc.jpg')).toBe(true)
      expect(is_decodable_by_card_renderer('https://lh3.googleusercontent.com/x/photo.JPEG')).toBe(true)
      expect(is_decodable_by_card_renderer('/api/dev-media/dict/photo/abc.png')).toBe(true)
    })
    test('a query string or hash never counts as the extension', () => {
      expect(is_decodable_by_card_renderer('https://example.com/a.png?v=2')).toBe(true)
      expect(is_decodable_by_card_renderer('https://example.com/a.webp?format=png')).toBe(false)
    })
    test('an extensionless URL is treated as undecodable (transcode rather than gamble)', () => {
      expect(is_decodable_by_card_renderer('https://media.livingdictionaries.app/dict/photo/f648f1ee')).toBe(false)
      expect(is_decodable_by_card_renderer('https://cdn.example.com/photos.v2/f648f1ee')).toBe(false)
    })
    test('the next format migration is covered too', () => {
      expect(is_decodable_by_card_renderer('https://media.livingdictionaries.app/d/photo/a_w1600.avif')).toBe(false)
      expect(is_decodable_by_card_renderer('https://media.livingdictionaries.app/d/photo/a.heic')).toBe(false)
    })
  })

  describe(card_image, () => {
    test('a decodable URL is returned untouched — no fetch, no transcode', async () => {
      const fetch_spy = vi.spyOn(globalThis, 'fetch')
      expect(await card_image({ image_url: 'https://media.livingdictionaries.app/d/photo/a.jpg', width: 1200, height: 630 })).toEqual({ url: 'https://media.livingdictionaries.app/d/photo/a.jpg' })
      expect(fetch_spy).not.toHaveBeenCalled()
      fetch_spy.mockRestore()
    })

    test('a fetch failure degrades to null so the card renders without the photo', async () => {
      const fetch_spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }))
      expect(await card_image({ image_url: 'https://media.livingdictionaries.app/d/photo/missing_w1600.webp', width: 1200, height: 630 })).toBe(null)
      fetch_spy.mockRestore()
    })

    test('a WebP variant comes back as a JPEG data URI cover-cropped to the card, WITH its dimensions (satori cannot measure a data URI)', async () => {
      const webp = await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 220, g: 30, b: 30 } } }).webp().toBuffer()
      const fetch_spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(webp, { status: 200 }))
      const result = await card_image({ image_url: 'https://media.livingdictionaries.app/d/photo/transcode-me_w1600.webp', width: 1200, height: 630 })
      expect(result?.url.startsWith('data:image/jpeg;base64,')).toBe(true)
      expect(result?.width).toBe(1200)
      expect(result?.height).toBe(630)
      fetch_spy.mockRestore()
    })

    test('an oversized source is refused rather than buffered into the render', async () => {
      const fetch_spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array(MAX_SOURCE_BYTES + 1), { status: 200 }))
      expect(await card_image({ image_url: 'https://media.livingdictionaries.app/d/photo/huge_w1600.webp', width: 1200, height: 630 })).toBe(null)
      fetch_spy.mockRestore()
    })
  })
}
