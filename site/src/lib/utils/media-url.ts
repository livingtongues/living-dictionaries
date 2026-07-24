/**
 * Pure media URL builders. Split from `media.ts` so they're unit-testable
 * without pulling in `$app/state` (via the dict-client `operations` import that
 * the upload helpers need).
 *
 * Dev media mock (no GCS bucket on dev): uploaded bytes live in the local
 * `/api/dev-media` store and are served back; existing pulled-dict audio/video
 * (which need the bucket) 302 to a bundled dummy from that same endpoint. Photos
 * keep using the public lh3 CDN, so real pulled photos still load with no bucket.
 */

import { R2_MEDIA_DOMAIN } from '$lib/constants'
import { is_r2_media_path, photo_variant_key, variant_for_size_spec } from './media-path'

/** DEV-only `serving_url` sentinel for an image uploaded with no bucket (bytes live in `/api/dev-media`). */
export const DEV_LOCAL_PREFIX = 'dev-local:'

/**
 * DUAL-READ (GCS→R2 migration, 2026-07): new-convention paths
 * (`{dict}/{audio|video|photo}/{uuid}.{ext}`) serve from the R2 media domain;
 * every legacy path keeps serving from GCS until its row is rewritten by the
 * migration driver (`scripts/media-migration/`). GCS stays live throughout as
 * the fallback — do not tear it down while old-convention rows exist.
 */
export function url_from_storage_path(path: string, storage_bucket: string): string {
  if (import.meta.env.DEV)
    return `/api/dev-media/${path}`
  if (is_r2_media_path(path))
    return `${R2_MEDIA_DOMAIN}/${path}`
  return `https://firebasestorage.googleapis.com/v0/b/${storage_bucket}/o/${encodeURIComponent(path)}?alt=media`
}

/**
 * Build an App Engine Images (lh3) `src` from a stored `serving_url` hash + an
 * lh3 size spec (the part after `=`, e.g. `s150-p`, `w900`, `s0`). A dev-uploaded
 * image (`dev-local:<key>`) is served from the local `/api/dev-media` store. An
 * empty hash renders the bundled placeholder on DEV only (useful for agents
 * testing without media); on prod it returns '' — callers must treat a missing
 * hash as "no image" (guard before rendering an <img>). Real hashes (incl.
 * pulled-dict photos) still go to the public lh3 CDN, so they load on dev with
 * no bucket.
 */
export function image_src(serving_url: string, size: string): string {
  if (serving_url?.startsWith(DEV_LOCAL_PREFIX))
    return `/api/dev-media/${serving_url.slice(DEV_LOCAL_PREFIX.length)}`
  if (!serving_url)
    return import.meta.env.DEV ? '/dev-placeholder-image.svg' : ''
  return `https://lh3.googleusercontent.com/${serving_url}=${size}`
}

/**
 * PHOTO DUAL-READ (Phase 2, 2026-07): the one photo `src` builder every surface
 * should use. A row whose `storage_path` follows the new R2 convention serves a
 * WebP variant (or the original for `s0`) from the R2 media domain; anything
 * else falls back to the legacy lh3 path via {@link image_src} (`serving_url`
 * hash — kept on migrated rows as a failsafe, but `storage_path` wins). `size`
 * is an lh3 size spec — see `variant_for_size_spec` for the mapping.
 */
export interface PhotoLike {
  storage_path?: string | null
  serving_url?: string | null
}

export function photo_src(photo: PhotoLike, size: string): string {
  const { storage_path, serving_url } = photo
  if (storage_path && is_r2_media_path(storage_path)) {
    const variant = variant_for_size_spec(size)
    const key = variant ? photo_variant_key({ original_key: storage_path, variant }) : storage_path
    if (import.meta.env.DEV)
      return `/api/dev-media/${key}`
    return `${R2_MEDIA_DOMAIN}/${key}`
  }
  return image_src(serving_url ?? '', size)
}

/**
 * Video THUMBNAIL src, in priority order: cached `hosted_metadata.thumbnail_url`
 * (YouTube/Vimeo oEmbed) → the R2 key convention `{dict}/video/{uuid}_thumb.webp`
 * (same `_thumb` suffix rule as photo variants; thumbnails are generated
 * out-of-band, so callers MUST attach an `onerror` fallback for videos whose
 * thumb doesn't exist yet) → null (legacy GCS path — render the icon chip).
 */
export interface VideoLike {
  storage_path?: string | null
  hosted_metadata?: { thumbnail_url?: string } | null
}

export function video_thumb_src(video: VideoLike): string | null {
  if (video.hosted_metadata?.thumbnail_url)
    return video.hosted_metadata.thumbnail_url
  const { storage_path } = video
  if (storage_path && is_r2_media_path(storage_path)) {
    const key = photo_variant_key({ original_key: storage_path, variant: 'thumb' })
    if (import.meta.env.DEV)
      return `/api/dev-media/${key}`
    return `${R2_MEDIA_DOMAIN}/${key}`
  }
  return null
}

if (import.meta.vitest) {
  test('image_src: real serving_url hash → public lh3 CDN (loads on dev with no bucket)', () => {
    expect(image_src('abc123', 's150-p')).toBe('https://lh3.googleusercontent.com/abc123=s150-p')
  })
  test('image_src: dev-local sentinel → local dev-media store', () => {
    expect(image_src(`${DEV_LOCAL_PREFIX}achi/images/s1/9.jpg`, 'w900')).toBe('/api/dev-media/achi/images/s1/9.jpg')
  })
  test('image_src: empty/missing hash → bundled placeholder (DEV only; vitest runs with DEV true — prod returns empty string)', () => {
    expect(image_src('', 's0')).toBe('/dev-placeholder-image.svg')
  })
  test('url_from_storage_path: dev routes through the local dev-media store', () => {
    // vitest runs with import.meta.env.DEV === true
    expect(url_from_storage_path('gta/audio/e1/1.mp3', 'some-bucket')).toBe('/api/dev-media/gta/audio/e1/1.mp3')
  })

  const uuid = '48af49b0-b410-4db1-babf-38ac53269e62'
  test('photo_src: new-convention storage_path → variant from the media store (dev prefix in vitest)', () => {
    expect(photo_src({ storage_path: `gta/photo/${uuid}.jpg`, serving_url: 'abc' }, 's400-p'))
      .toBe(`/api/dev-media/gta/photo/${uuid}_thumb.webp`)
    expect(photo_src({ storage_path: `gta/photo/${uuid}.jpg`, serving_url: 'abc' }, 'w1200'))
      .toBe(`/api/dev-media/gta/photo/${uuid}_w1600.webp`)
    expect(photo_src({ storage_path: `gta/photo/${uuid}.jpg` }, 's0'))
      .toBe(`/api/dev-media/gta/photo/${uuid}.jpg`)
  })
  test('video_thumb_src: hosted metadata wins; R2-convention path derives _thumb.webp; legacy → null', () => {
    expect(video_thumb_src({ hosted_metadata: { thumbnail_url: 'https://i.ytimg.com/vi/x/hqdefault.jpg' } }))
      .toBe('https://i.ytimg.com/vi/x/hqdefault.jpg')
    expect(video_thumb_src({ storage_path: `gta/video/${uuid}.mp4` }))
      .toBe(`/api/dev-media/gta/video/${uuid}_thumb.webp`) // vitest runs with DEV true; prod serves from R2_MEDIA_DOMAIN
    expect(video_thumb_src({ storage_path: 'chikunda/videos/0HEnsXumMo5QXAmlTvI0_1676752690966.mp4' })).toBe(null)
    expect(video_thumb_src({})).toBe(null)
  })

  test('photo_src: legacy rows fall back to lh3 via serving_url', () => {
    expect(photo_src({ storage_path: 'gta/images/x_123.jpg', serving_url: 'abc123' }, 'w900'))
      .toBe('https://lh3.googleusercontent.com/abc123=w900')
    expect(photo_src({ serving_url: `${DEV_LOCAL_PREFIX}achi/images/s1/9.jpg` }, 'w900'))
      .toBe('/api/dev-media/achi/images/s1/9.jpg')
    expect(photo_src({}, 's0')).toBe('/dev-placeholder-image.svg')
  })
}
