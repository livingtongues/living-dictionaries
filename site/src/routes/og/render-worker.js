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

const { font, module_urls = {} } = workerData

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

/** @param {{ markup: string, height: number, width: number, id: number }} job */
async function render_png({ markup, height, width, id }) {
  const { satori, to_react_node, Resvg } = await render_chain()

  const base_options = {
    fonts: [{ name: 'Noto+Sans', data: font_data, style: 'normal' }],
    height,
    width,
  }

  let svg
  try {
    svg = await satori(to_react_node(markup), {
      ...base_options,
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
    warn({ id, error, context: { retry: 'static_fonts_only', width, height } })
    svg = await satori(to_react_node(markup), base_options)
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

// @TODO: Cover most languages with Noto Sans.
const language_font_map = {
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

const load_dynamic_asset = with_bounded_cache(async (code, text) => {
  let names = language_font_map[code]
  // Re-read after falling back — otherwise `names` stays undefined and the loop
  // below throws `names is not iterable`, which the catch then reports as a
  // spurious `dynamic_font_fetch` failure. Production hit it on an emoji card
  // (2026-07-29T01:35) and on every other script missing from the map.
  if (!names) {
    code = 'unknown'
    names = language_font_map[code]
  }

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
      if (res.status === HTTP_OK) {
        return {
          name: `satori_${code}_fallback_${text}`,
          data: await res.arrayBuffer(),
          weight: 400,
          style: 'normal',
        }
      }
    }
  } catch (error) {
    warn({ id: null, error, context: { reason: 'dynamic_font_fetch', text } })
  }
})

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
