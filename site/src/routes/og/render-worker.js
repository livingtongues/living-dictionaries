/**
 * The share-card rasterizer — satori + resvg, running in a WORKER THREAD.
 *
 * WHY THIS FILE EXISTS (2026-07-28, `.issues/og-endpoint-load-outages.md`):
 * satori and resvg are both fully SYNCHRONOUS. Rendering a 1200×630 card is
 * ~700–840 ms of straight-line CPU with no `await` in it, so on the request
 * thread it doesn't slow a health check down — it makes the event loop
 * unreachable for that whole time. That is what took the site down on
 * 2026-07-27: `/healthz` (which returns the string "ok") climbed to 3,251 ms,
 * past Caddy's 2 s health timeout, and Caddy marked BOTH containers down.
 * Storing rendered cards removed the repeat cost, but a genuine MISS still had
 * to be paid by whoever's request happened to be in flight. Here nobody's is.
 *
 * WHY IT IS PLAIN JS, AND WHY IT IS SHIPPED AS A STRING: it's loaded with vite's
 * `?raw` (its text is inlined into the server bundle at build time) and spawned
 * with `new Worker(source, { eval: true })`. A worker needs a real file at a
 * real path at runtime, and the Docker runner only copies `site/build` — a `.ts`
 * file next to this one would simply not be there. Inlining the source sidesteps
 * the whole question, in dev, in vitest and in the container alike.
 *
 * CONSEQUENCES OF THAT, both load-bearing:
 *  - It CANNOT import project files (`$lib/...`) — everything it needs arrives in
 *    `workerData` or in the job message.
 *  - Eval'd worker code runs as CommonJS, so `require` is available but `import`
 *    statements are not; packages are loaded with dynamic `import()`. The parent
 *    resolves them to absolute file URLs (`module_urls`) because a bare specifier
 *    here would resolve against the process CWD, which is nobody's contract.
 */

/* eslint-disable @typescript-eslint/no-require-imports -- eval'd worker code is CommonJS: `import` statements are a syntax error here. */
const { parentPort, workerData } = require('node:worker_threads')

const { font, module_urls = {}, language_font_map = {} } = workerData

/** @param {string} specifier */
function load(specifier) {
  return import(module_urls[specifier] || specifier)
}

/**
 * Load the render chain ONCE per worker, starting the moment the worker boots
 * rather than when the first job lands — the parent spawns us on a cache miss,
 * so the ~300 ms of module loading overlaps the job it is about to send.
 */
let chain = null
function render_chain() {
  chain ??= Promise.all([load('satori'), load('satori-html'), load('@resvg/resvg-js')])
    .then(([satori_module, satori_html, resvg_module]) => ({
      satori: satori_module.default || satori_module,
      to_react_node: satori_html.html,
      Resvg: resvg_module.Resvg,
    }))
  return chain
}
render_chain()

const font_data = Buffer.from(font)

/**
 * A FRESH options object with a FRESH `fonts` ARRAY, every single time.
 *
 * Not a style choice — satori caches its FontLoader in a WeakMap keyed by the
 * IDENTITY of `options.fonts` (`Is.has(e.fonts) ? … : Is.set(e.fonts, new …)`),
 * and `loadAdditionalAsset` results are `addFonts`-ed into that loader. Reusing
 * one array, as this file did until 2026-07-31, has two consequences that were
 * both live in production:
 *
 *  1. **The retry below was a no-op.** It re-rendered against the very loader
 *     that had just been handed the font that threw, so "retry with NotoSans
 *     only" never once ran with NotoSans only. Measured: an Arabic card failed,
 *     retried, and failed identically — which is why the 1,486 daily font
 *     failures from one Arabic-script dictionary (2026-07-29 review) were
 *     GENERIC CARDS, not merely tofu ones.
 *  2. **Every dynamic font ever fetched accumulated in one loader** for the life
 *     of the worker — unbounded growth across distinct (script, text) runs, and
 *     one unparseable face poisoning every later card whose text needs fallback.
 *
 * A new array costs nothing: satori caches the PARSED font by data buffer
 * separately, and `font_data` is the same Buffer every time.
 */
function fresh_options({ height, width }) {
  return { fonts: [{ name: 'Noto+Sans', data: font_data, style: 'normal' }], height, width }
}

/** @param {{ markup: string, height: number, width: number, id: number }} job */
async function render_png({ markup, height, width, id }) {
  const { satori, to_react_node, Resvg } = await render_chain()

  let svg
  last_dynamic_asset = { script: null, family: null } // never label this card with the last one's script
  try {
    svg = await satori(to_react_node(markup), {
      ...fresh_options({ height, width }),
      // Dynamically-fetched Google fonts (for non-Latin scripts) are parsed INSIDE
      // satori by @shuding/opentype.js, which throws on some GSUB tables it doesn't
      // support (e.g. "lookupType: 5 - substFormat: 3 is not yet supported") — the
      // font FETCH is guarded but the parse is not, so a bad fallback font would
      // otherwise 500 the whole share image.
      loadAdditionalAsset: (...args) => load_dynamic_asset(...args),
    })
  } catch (error) {
    // Retry with NotoSans only (non-Latin glyphs may tofu) so the card never 500s.
    // An `image_fetch` fault fails this retry too; the route's outer catch then
    // renders the text-only fallback card.
    warn({ id, error, context: { retry: 'static_fonts_only', script: last_dynamic_asset.script, family: last_dynamic_asset.family, width, height } })
    svg = await satori(to_react_node(markup), fresh_options({ height, width }))
  }

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } })
  const rendered = resvg.render()
  return rendered.asPng()
}

let render_tail = Promise.resolve()

parentPort.on('message', (job) => {
  const render = render_tail.then(() => render_png(job))
  render_tail = render.catch(() => undefined)
  render.then(
    (png) => {
      // Cloned, not transferred: `asPng()` hands back a node Buffer, whose backing
      // ArrayBuffer may be a slice of the shared 8 KB pool — transferring that
      // would detach the pool out from under everything else in this thread.
      parentPort.postMessage({ type: 'done', id: job.id, png: new Uint8Array(png) })
    },
    (error) => {
      parentPort.postMessage({ type: 'failed', id: job.id, message: error?.message ?? String(error), stack: error?.stack ?? null })
    },
  )
})

/** Non-fatal notes the parent turns into `og_render_failed` telemetry. */
function warn({ id, error, context }) {
  parentPort.postMessage({ type: 'warn', id, message: error?.message ?? String(error), stack: error?.stack ?? null, context })
}

/**
 * Google Fonts has no business holding a render open. Production logged repeated
 * `Failed to load dynamic font … AggregateError [ETIMEDOUT]` — with no timeout at
 * all, one CDN hiccup pinned the (single) render slot for the full ~21 s OS
 * connect timeout while `/healthz` starved behind it.
 */
const FONT_FETCH_TIMEOUT_MS = 3000
/** Font subsets are keyed per (script, text run) — a card's worth of glyphs each. */
const FONT_CACHE_LIMIT = 100
/** `$lib/constants` is unreachable from an eval'd worker (see the file header). */
const HTTP_OK = 200

/**
 * The last dynamic font this render asked for, so the `static_fonts_only` retry
 * can NAME the script that cost it.
 *
 * Without this, "1,536 font failures a day" was a number nobody could act on: it
 * took a hand-written log query to discover that 1,486 of them were one
 * Arabic-script dictionary (2026-07-29 review). Set here, read there — safe
 * because the worker renders exactly one card at a time (`render_tail`).
 */
let last_dynamic_asset = { script: null, family: null }

/**
 * MIRRORS `families_for_script` in `font-map.ts` — an eval'd worker cannot
 * import it, but the MAP itself is not duplicated: it rides `workerData`. See
 * that file for why a code may name several scripts at once (`ja-JP|zh-CN|…`).
 */
function families_for(code) {
  const families = [...new Set(String(code).split('|').flatMap(part => language_font_map[part] || []))]
  if (families.length)
    return { families, mapped: true }
  return { families: language_font_map.unknown || [], mapped: false }
}

/**
 * The fonts satori should add for one script + text run.
 *
 * EVERY exit that yields no usable font WARNS. Google Fonts answers 200 with a
 * perfectly valid font containing none of the requested glyphs, so a silent
 * `unknown` rescue makes a wrong card indistinguishable from a right one — it
 * gets cached for a year and nobody finds out. A card with missing glyphs is a
 * FAILURE that happens to have pixels. (house, 2026-07-30: a day of tofu Hebrew
 * and CJK cards with zero telemetry.)
 *
 * Returns an ARRAY, and fetches the whole candidate list in PARALLEL: satori
 * resolves fallbacks per GLYPH across every font it has been handed, so giving
 * it all four Han faces (or both Symbols faces) is strictly better than picking
 * one on our behalf — and parallel keeps four families inside one 3 s bound
 * rather than four of them, which would blow the pool's render deadline.
 */
const load_dynamic_asset = with_bounded_cache(async (code, text) => {
  const { families, mapped } = families_for(code)
  if (!mapped) {
    warn({
      id: null,
      error: new Error(`no font is mapped for satori script "${code}" — its glyphs will be missing`),
      context: { reason: 'font_unmapped', script: code, text },
    })
  }

  const fonts = (await Promise.all(families.map(family => load_font_family({ code, family, text })))).filter(Boolean)
  if (!fonts.length) {
    warn({
      id: null,
      error: new Error(`no font could be loaded for satori script "${code}"`),
      context: { reason: 'font_unavailable', script: code, families: families.join(','), text },
    })
    return undefined
  }
  return fonts
})

/** One family's subset for this text run, or null (having said why). */
async function load_font_family({ code, family, text }) {
  last_dynamic_asset = { script: code, family }
  const API = `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`
  try {
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
    if (!resource) {
      // Used to be a bare `return` — a misspelled family or a Google response
      // shape change would silently produce an unstyled card forever.
      warn({ id: null, error: new Error(`no TTF in the Google Fonts CSS for ${family}`), context: { reason: 'font_css_unparsable', script: code, family, text } })
      return null
    }

    const res = await fetch(resource[1], { signal: AbortSignal.timeout(FONT_FETCH_TIMEOUT_MS) })
    if (res.status !== HTTP_OK) {
      warn({ id: null, error: new Error(`Google Fonts answered ${res.status} for ${family}`), context: { reason: 'font_fetch_status', status: res.status, script: code, family, text } })
      return null
    }

    // The name must be unique per FAMILY as well as per script: satori keys its
    // font table by name, so two families sharing one name would shadow each
    // other and the per-glyph fallback would have only one face to try.
    return { name: `satori_${code}_${family}_fallback_${text}`, data: await res.arrayBuffer(), weight: 400, style: 'normal' }
  } catch (error) {
    // `timed_out` separates "Google Fonts is slow/unreachable" (ours to bound)
    // from "that font's tables break the parser" (ours to bundle around).
    warn({ id: null, error, context: { reason: 'dynamic_font_fetch', script: code, family, timed_out: error?.name === 'TimeoutError' || error?.name === 'AbortError', text } })
    return null
  }
}

/**
 * Bounded memo, insertion-ordered so the oldest entry is evicted first. Caches
 * NEGATIVE results too (an `undefined` from a failed/timed-out font fetch), so a
 * font CDN outage costs one attempt per text run rather than one per card.
 */
function with_bounded_cache(fn) {
  const cache = new Map()
  return async (...args) => {
    const key = args.join('|')
    if (cache.has(key)) return cache.get(key)
    const result = await fn(...args)
    if (cache.size >= FONT_CACHE_LIMIT)
      cache.delete(cache.keys().next().value)
    cache.set(key, result)
    return result
  }
}
