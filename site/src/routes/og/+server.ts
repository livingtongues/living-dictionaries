import type { RequestHandler } from './$types'
import { card_image } from './card-image'
import { card_key, read_card, save_card } from './card-store'
import { classify_og_failure, render_component_to_png } from './component-to-png'
import { GENERIC_CARD_KEY, GENERIC_PROPS } from './generic-card'
import { create_render_queue } from './render-queue'
import OpenGraphImage from './OpenGraphImage.svelte'
import { decompressFromEncodedURIComponent as decode } from '$lib/lz/lz-string'
import { log_server_event } from '$lib/server/log-server-event'

const HEIGHT = 630
const WIDTH = 1200

/** 1×1 transparent PNG — the absolute last resort so a social scraper NEVER sees a 500. */
const BLANK_PNG: Uint8Array = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const CARD_HEADERS = { 'content-type': 'image/png', 'cache-control': 'public, immutable, no-transform, max-age=31536000' }
/** A degraded card must NEVER be cached like a real one — the scraper has to come back. */
const DEGRADED_HEADERS = { 'content-type': 'image/png', 'cache-control': 'public, no-transform, max-age=60' }

/**
 * How much of this BOX the share cards may have.
 *
 * The rendering itself no longer runs here — satori + resvg live in a worker
 * thread (`render-worker.js`), so a card can never make this thread unreachable
 * the way it did on 2026-07-27. What's left for the queue to bound is the box's
 * second core and the backlog: ONE render at a time (one worker), a cap on how
 * many requests may sit waiting for it, and a ceiling on how much of any 10 s
 * window the renderer may occupy at all.
 *
 * The budget is deliberately loose now (0.9 vs the 0.5 that protected the
 * request thread): a burst may keep the worker busy nearly continuously —
 * that's what it's for — but never so relentlessly that `sharp`, sync, and the
 * crons are fighting one core for the whole window.
 */
const render_queue = create_render_queue({
  limit: 1,
  // Waiting is now free for everyone else — the waiter holds a socket, not the
  // thread — and scrapers are patient, so wait long enough to hand back a REAL
  // card rather than the spare. (Facebook's scraper gives ~10 s.)
  wait_deadline_ms: 8000,
  max_waiting: 12,
  busy_window_ms: 10_000,
  busy_ratio: 0.9,
})

/**
 * `BodyInit` only accepts a view over a plain `ArrayBuffer`, and neither a node
 * `Buffer` nor a `Uint8Array<ArrayBufferLike>` is one — hence the re-wrap (a
 * ~220 KB memcpy, immaterial next to a render).
 */
function png_response(png: Uint8Array, headers: Record<string, string>): Response {
  return new Response(new Uint8Array(png), { headers })
}

/** A shed request costs no CPU: the stored generic card if we have one, else 1×1. */
function degraded_response(): Response {
  return png_response(read_card(GENERIC_CARD_KEY) ?? BLANK_PNG, DEGRADED_HEADERS)
}

let generic_warm_attempted = false

/**
 * Render the generic card ONCE per process, while nothing else is going on, so a
 * shed request can be answered with a real Living Dictionaries card instead of a
 * transparent pixel. Never on the request path, never while the budget shows any
 * recent render, and never more than once — a spare tyre isn't worth an outage.
 */
function warm_generic_card_when_idle(): void {
  if (generic_warm_attempted)
    return
  if (read_card(GENERIC_CARD_KEY)) {
    generic_warm_attempted = true
    return
  }
  if (render_queue.stats().busy_ms !== 0)
    return // busy right now; a later request will try again
  generic_warm_attempted = true
  setTimeout(async () => {
    const slot = await render_queue.acquire()
    if (!slot)
      return
    try {
      save_card({ key: GENERIC_CARD_KEY, png: await render_component_to_png({ component: OpenGraphImage, props: { ...GENERIC_PROPS }, height: HEIGHT, width: WIDTH }) })
    } catch (error) {
      log_server_event({ level: 'warn', message: 'og_render_failed', error, context: { reason: classify_og_failure(error), fallback: 'generic_warm' } })
    } finally {
      slot.release()
    }
  }, 0).unref?.()
}

/**
 * Share-image endpoint (Open Graph cards). Link scrapers (Facebook/Slack/…)
 * hit this — a 500 silently breaks every share of that page, so every failure
 * degrades instead: bad props → generic card; satori/resvg failure (e.g. a
 * remote entry-photo fetch dying) → text-only card without the remote photo;
 * total render failure → a blank 200 PNG. Each emits `og_render_failed`.
 *
 * Shape (2026-07-27/28, `.issues/og-endpoint-load-outages.md`): a card is
 * rendered ONCE and stored on disk, so the crawler bursts that re-request the
 * same cards every five minutes now cost one file read. Only a genuine miss
 * reaches the render queue, only one render runs at a time, and the render
 * itself happens in a WORKER THREAD — so even a miss costs this thread nothing
 * but a `postMessage`, and a health check can never queue behind a card.
 */
export const GET: RequestHandler = async ({ url }) => {
  const props_param = url.searchParams.get('props')
  const key = card_key({ props_param, image_version: url.searchParams.get('v') })

  const stored = read_card(key)
  if (stored)
    return png_response(stored, CARD_HEADERS)

  warm_generic_card_when_idle()

  let props: Record<string, unknown>
  try {
    props = JSON.parse(decode(props_param))
    if (!props || typeof props !== 'object')
      throw new Error('og props did not decode to an object')
  } catch (error) {
    log_server_event({ level: 'warn', message: 'og_render_failed', error, context: { reason: 'parse' } })
    props = { ...GENERIC_PROPS }
  }
  const height = (props.height as number) || HEIGHT
  const width = (props.width as number) || WIDTH

  const queued_at = Date.now()
  const slot = await render_queue.acquire()
  if (!slot) {
    // Saturated. Costing this request ZERO CPU is the whole point — the site
    // staying up beats a pretty card, and the short TTL brings the scraper back.
    log_server_event({ level: 'warn', message: 'og_render_shed', context: { waited_ms: Date.now() - queued_at, ...render_queue.stats() } })
    return degraded_response()
  }
  const wait_ms = Date.now() - queued_at
  const started_at = Date.now()

  try {
    // The photo has to arrive in a format resvg can rasterize — since the 2026-07-23
    // WebP migration it does not, so `card_image` transcodes it (see card-image.ts).
    // An unobtainable photo becomes `undefined`, which renders the globe card directly
    // instead of burning two doomed renders on the way to the text-only fallback.
    // Inside the slot deliberately: the fetch + transcode is part of what a burst
    // multiplies, so ONE gate bounds the whole chain rather than just its tail.
    if (typeof props.image_url === 'string') {
      const image = await card_image({ image_url: props.image_url, width, height })
      props.image_url = image?.url ?? undefined
      props.image_width = image?.width
      props.image_height = image?.height
    }

    try {
      const png = await render_component_to_png({ component: OpenGraphImage, props, height, width })
      save_card({ key, png })
      // Miss-only telemetry: once the store is warm this IS the render rate. The
      // endpoint used to log failures ONLY, so its cost had to be inferred from
      // container memory growth (2.87 GiB vs 1.17 GiB) rather than measured.
      log_server_event({ level: 'info', message: 'og_card_rendered', context: { render_ms: Date.now() - started_at, wait_ms, width, height, photo: !!props.image_url } })
      return png_response(png, CARD_HEADERS)
    } catch (error) {
      const reason = classify_og_failure(error)
      log_server_event({ level: 'warn', message: 'og_render_failed', error, context: { reason, dict: props.dictionaryName ?? null, title: props.title ?? null } })
      // A dead or wedged RENDERER will fail the fallback the same way, and a
      // second render timeout would hold this slot for another 20 s. Give up now.
      if (reason === 'worker')
        return degraded_response()
    }

    // Text-only fallback: drop the remote entry photo (the usual killer) and re-render.
    try {
      const { image_url: _omit, ...text_props } = props
      const png = await render_component_to_png({ component: OpenGraphImage, props: text_props, height, width })
      save_card({ key, png })
      return png_response(png, CARD_HEADERS)
    } catch (error) {
      log_server_event({ level: 'warn', message: 'og_render_failed', error, context: { reason: classify_og_failure(error), fallback: 'text_only', dict: props.dictionaryName ?? null } })
      // NOT stored under this card's key: a failure must never become this URL's
      // permanent answer.
      return degraded_response()
    }
  } finally {
    slot.release()
  }
}
