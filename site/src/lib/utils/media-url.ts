/**
 * Pure media URL builders. Split from `media.ts` so they're unit-testable
 * without pulling in `$app/state` (via the dict-client `operations` import that
 * the upload helpers need).
 *
 * In dev, uploaded bytes live in the local `/api/dev-media` store. Production
 * media is served by the public R2 custom domain.
 */

import { R2_MEDIA_DOMAIN } from '$lib/constants'
import type { PhotoVariant } from './media-path'
import { is_r2_media_path, photo_variant_key } from './media-path'

export function url_from_storage_path(path: string): string {
  if (import.meta.env.DEV)
    return `/api/dev-media/${path}`
  return `${R2_MEDIA_DOMAIN}/${path}`
}

/** The one photo `src` builder every surface should use. */
export interface PhotoLike {
  storage_path?: string | null
}

export function photo_variant_for_dimensions({ is_square, pixels }: { is_square?: boolean, pixels?: number }): PhotoVariant | 'original' {
  if (!pixels)
    return 'original'
  if (is_square && pixels <= 400)
    return 'thumb'
  return pixels <= 900 ? 'w900' : 'w1600'
}

export function photo_src({ photo, variant }: { photo: PhotoLike, variant: PhotoVariant | 'original' }): string {
  const { storage_path } = photo
  if (!storage_path || !is_r2_media_path(storage_path))
    return import.meta.env.DEV ? '/dev-placeholder-image.svg' : ''
  const key = variant === 'original' ? storage_path : photo_variant_key({ original_key: storage_path, variant })
  return url_from_storage_path(key)
}

/**
 * Video THUMBNAIL src, in priority order: cached `hosted_metadata.thumbnail_url`
 * (YouTube/Vimeo oEmbed) → the R2 key convention `{dict}/video/{uuid}_thumb.webp`
 * (same `_thumb` suffix rule as photo variants; thumbnails are generated
 * out-of-band, so callers MUST attach an `onerror` fallback for videos whose
 * thumb doesn't exist yet) → null (hosted-only video — render the icon chip).
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
  test('url_from_storage_path: dev routes through the local dev-media store', () => {
    // vitest runs with import.meta.env.DEV === true
    expect(url_from_storage_path('gta/audio/e1/1.mp3')).toBe('/api/dev-media/gta/audio/e1/1.mp3')
  })

  const uuid = '48af49b0-b410-4db1-babf-38ac53269e62'
  test('photo_src: new-convention storage_path → variant from the media store (dev prefix in vitest)', () => {
    expect(photo_src({ photo: { storage_path: `gta/photo/${uuid}.jpg` }, variant: 'thumb' }))
      .toBe(`/api/dev-media/gta/photo/${uuid}_thumb.webp`)
    expect(photo_src({ photo: { storage_path: `gta/photo/${uuid}.jpg` }, variant: 'w1600' }))
      .toBe(`/api/dev-media/gta/photo/${uuid}_w1600.webp`)
    expect(photo_src({ photo: { storage_path: `gta/photo/${uuid}.jpg` }, variant: 'original' }))
      .toBe(`/api/dev-media/gta/photo/${uuid}.jpg`)
  })
  test('video_thumb_src: hosted metadata wins; R2 path derives _thumb.webp; invalid path → null', () => {
    expect(video_thumb_src({ hosted_metadata: { thumbnail_url: 'https://i.ytimg.com/vi/x/hqdefault.jpg' } }))
      .toBe('https://i.ytimg.com/vi/x/hqdefault.jpg')
    expect(video_thumb_src({ storage_path: `gta/video/${uuid}.mp4` }))
      .toBe(`/api/dev-media/gta/video/${uuid}_thumb.webp`) // vitest runs with DEV true; prod serves from R2_MEDIA_DOMAIN
    expect(video_thumb_src({ storage_path: 'chikunda/videos/not-a-media-uuid.mp4' })).toBe(null)
    expect(video_thumb_src({})).toBe(null)
  })

  test('photo_src: missing or invalid storage paths never leave the R2/dev-media boundary', () => {
    expect(photo_src({ photo: { storage_path: 'gta/images/x_123.jpg' }, variant: 'w900' }))
      .toBe('/dev-placeholder-image.svg')
    expect(photo_src({ photo: {}, variant: 'original' })).toBe('/dev-placeholder-image.svg')
  })

  test(photo_variant_for_dimensions, () => {
    expect(photo_variant_for_dimensions({ is_square: true, pixels: 340 })).toBe('thumb')
    expect(photo_variant_for_dimensions({ pixels: 340 })).toBe('w900')
    expect(photo_variant_for_dimensions({ pixels: 1200 })).toBe('w1600')
    expect(photo_variant_for_dimensions({})).toBe('original')
  })
}
