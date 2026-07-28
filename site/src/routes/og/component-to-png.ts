import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { html as toReactNode } from 'satori-html'
import { render } from 'svelte/server'

// Vite plugin turns import into the result of readFileSync during build
import type { Component } from 'svelte'
import NotoSans from './notoSans.ttf'
import { ResponseCodes } from '$lib/constants'
import { log_server_event } from '$lib/server/log-server-event'

// based on what text is contained in the props, load fonts accordingly

function render_svg({ markup, height, width, load_dynamic }: {
  markup: ReturnType<typeof toReactNode>
  height: number
  width: number
  load_dynamic: boolean
}): Promise<string> {
  return satori(markup, {
    fonts: [
      {
        name: 'Noto+Sans',
        data: Buffer.from(NotoSans),
        style: 'normal',
      },
    ],
    // debug: true,
    height,
    width,
    // Dynamically-fetched Google fonts (for non-Latin scripts) are parsed INSIDE
    // satori by @shuding/opentype.js, which throws on some GSUB tables it doesn't
    // support (e.g. "lookupType: 5 - substFormat: 3 is not yet supported") — the
    // font FETCH is guarded but the parse is not, so a bad fallback font would
    // otherwise 500 the whole share image. The get_png caller retries with this
    // OFF (NotoSans-only) so the OG image still renders (Latin/tofu) rather than break.
    ...(load_dynamic ? { loadAdditionalAsset: (...args: string[]) => loadDynamicAsset(...args) } : {}),
  })
}

/**
 * Name the failure class for `og_render_failed` telemetry — the old blanket
 * `og_font_unsupported` label actively misled triage when the real fault was
 * satori failing to fetch a remote entry photo (2026-07-08 review).
 */
export function classify_og_failure(error: unknown): 'image_fetch' | 'font' | 'render' {
  const message = (error as { message?: unknown } | null | undefined)?.message
  if (typeof message === 'string') {
    if (/load.{0,20}image|image.{0,30}fetch failed/i.test(message))
      return 'image_fetch'
    if (/font|lookupType|substFormat|glyph|opentype/i.test(message))
      return 'font'
  }
  return 'render'
}

/**
 * NOT memoized in process. Rendered cards are persisted by `card-store.ts` and
 * looked up before this is ever called — the old in-process `withCache` here was
 * an unbounded `Map` holding every ~220 KB PNG for the life of the container
 * (2.87 GiB serving vs 1.17 GiB idle standby, 2026-07-27). Disk is the cache.
 */
async function get_png(html: string, height: number, width: number): Promise<Uint8Array> {
  const markup = toReactNode(html)
  let svg: string
  try {
    svg = await render_svg({ markup, height, width, load_dynamic: true })
  } catch (error) {
    // A dynamic fallback font tripped satori's opentype.js parse — fall back to a
    // NotoSans-only render (non-Latin glyphs may tofu) so the share image never 500s.
    // (An `image_fetch` fault will fail this retry too; the route's outer catch
    // then renders the text-only fallback card.)
    log_server_event({ level: 'warn', message: 'og_render_failed', error, context: { reason: classify_og_failure(error), retry: 'static_fonts_only', width, height } })
    svg = await render_svg({ markup: toReactNode(html), height, width, load_dynamic: false })
  }

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: width,
    },
  })

  return resvg.render().asPng()
}

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
  // comment markers satori-html doesn't need.
  const result = render(component, { props })
  const markup = result.body.replace(/<!--[[\]]?-->/g, '')
  return get_png(markup, height, width)
}

// @TODO: Cover most languages with Noto Sans.
const languageFontMap = {
  zh: 'Noto+Sans+SC',
  ja: 'Noto+Sans+JP',
  ko: 'Noto+Sans+KR',
  th: 'Noto+Sans+Thai',
  he: 'Noto+Sans+Hebrew',
  ar: 'Noto+Sans+Arabic',
  bn: 'Noto+Sans+Bengali',
  ta: 'Noto+Sans+Tamil',
  te: 'Noto+Sans+Telugu',
  ml: 'Noto+Sans+Malayalam',
  devanagari: 'Noto+Sans+Devanagari',
  kannada: 'Noto+Sans+Kannada',
  symbol: ['Noto+Sans+Symbols', 'Noto+Sans+Symbols+2'],
  math: 'Noto+Sans+Math',
  unknown: 'Noto+Sans',
}
type LanguageCode = keyof typeof languageFontMap

/**
 * Google Fonts has no business holding a render slot open. Production logged
 * repeated `Failed to load dynamic font … AggregateError [ETIMEDOUT]` — with no
 * timeout at all, one CDN hiccup pinned the (now single) render slot for the
 * full ~21 s OS connect timeout while `/healthz` starved behind it.
 */
const FONT_FETCH_TIMEOUT_MS = 3000

const loadDynamicAsset = with_bounded_cache(
  async (code: LanguageCode, text: string) => {
    // Try to load from Google Fonts.
    let names = languageFontMap[code]
    if (!names) code = 'unknown'

    try {
      if (typeof names === 'string')
        names = [names]

      for (const name of names) {
        const API = `https://fonts.googleapis.com/css2?family=${name}&text=${encodeURIComponent(text)}`

        const css = await (
          await fetch(API, {
            signal: AbortSignal.timeout(FONT_FETCH_TIMEOUT_MS),
            headers: {
              // Make sure it returns TTF.
              'User-Agent':
                'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
            },
          })
        ).text()

        const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/)

        if (!resource) return

        const res = await fetch(resource[1], { signal: AbortSignal.timeout(FONT_FETCH_TIMEOUT_MS) })
        if (res.status === ResponseCodes.OK) {
          const font = await res.arrayBuffer()
          return {
            name: `satori_${code}_fallback_${text}`,
            data: font,
            weight: 400,
            style: 'normal',
          }
        }
      }
    } catch (e) {
      console.error('Failed to load dynamic font for', text, '. Error:', e)
    }
  },
)

/** Font subsets are keyed per (script, text run) — a card's worth of glyphs each. */
const FONT_CACHE_LIMIT = 100

/**
 * Bounded memo, insertion-ordered so the oldest entry is evicted first. Caches
 * NEGATIVE results too (a `undefined` from a failed/timed-out font fetch), so a
 * font CDN outage costs one attempt per text run rather than one per request.
 *
 * The unbounded version of this used to wrap the PNG renderer as well; that was
 * the 1.7 GiB leak. Anything cached in this process is now capped.
 */
function with_bounded_cache(fn: (...args: any[]) => any) {
  const cache = new Map<string, any>()
  return async (...args: (string | number)[]) => {
    const key = hash(args.join())
    if (cache.has(key)) return cache.get(key)
    const result = await fn(...args)
    if (cache.size >= FONT_CACHE_LIMIT)
      cache.delete(cache.keys().next().value)
    cache.set(key, result)
    return result
  }
}

function hash(str: string) {
  let i; let l
  let hval = 0x811C9DC5

  for (i = 0, l = str.length; i < l; i++) {
    hval ^= str.charCodeAt(i)
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24)
  }
  return (`00000${(hval >>> 0).toString(36)}`).slice(-6)
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
    test('anything else is render', () => {
      expect(classify_og_failure(new Error('something unexpected'))).toBe('render')
      expect(classify_og_failure(null)).toBe('render')
    })
  })
}
