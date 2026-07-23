import type { RequestHandler } from './$types'
import { classify_og_failure, component_to_png } from './component-to-png'
import OpenGraphImage from './OpenGraphImage.svelte'
import { decompressFromEncodedURIComponent as decode } from '$lib/lz/lz-string'
import { log_server_event } from '$lib/server/log-server-event'

const HEIGHT = 630
const WIDTH = 1200

/** 1×1 transparent PNG — the absolute last resort so a social scraper NEVER sees a 500. */
const BLANK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

/**
 * Share-image endpoint (Open Graph cards). Link scrapers (Facebook/Slack/…)
 * hit this — a 500 silently breaks every share of that page, so every failure
 * degrades instead: bad props → generic card; satori/resvg failure (e.g. the
 * lh3 entry-photo fetch dying) → text-only card without the remote photo;
 * total render failure → a blank 200 PNG. Each emits `og_render_failed`.
 */
export const GET: RequestHandler = async ({ url }) => {
  let props: Record<string, unknown>
  try {
    props = JSON.parse(decode(url.searchParams.get('props')))
    if (!props || typeof props !== 'object')
      throw new Error('og props did not decode to an object')
  } catch (error) {
    log_server_event({ level: 'warn', message: 'og_render_failed', error, context: { reason: 'parse' } })
    props = { title: 'Living Dictionaries', description: 'Language documentation web app for communities', dictionaryName: '' }
  }
  const height = (props.height as number) || HEIGHT
  const width = (props.width as number) || WIDTH

  try {
    return await component_to_png(OpenGraphImage, props, height, width)
  } catch (error) {
    log_server_event({ level: 'warn', message: 'og_render_failed', error, context: { reason: classify_og_failure(error), dict: props.dictionaryName ?? null, title: props.title ?? null } })
  }

  // Text-only fallback: drop the remote entry photo (the usual killer) and re-render.
  try {
    const { gcsPath: _omit, image_url: _omit_r2, ...text_props } = props
    return await component_to_png(OpenGraphImage, text_props, height, width)
  } catch (error) {
    log_server_event({ level: 'warn', message: 'og_render_failed', error, context: { reason: classify_og_failure(error), fallback: 'text_only', dict: props.dictionaryName ?? null } })
    return new Response(BLANK_PNG, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=300' } })
  }
}
