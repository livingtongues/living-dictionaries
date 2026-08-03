/**
 * Pure helpers for R2 media keys. Row ids are UUIDs minted before upload:
 * `{dict_id}/{audio|video|photo}/{media_row_id}.{ext}`.
 */

export const R2_MEDIA_KINDS = ['audio', 'video', 'photo'] as const
export type R2MediaKind = typeof R2_MEDIA_KINDS[number]

const R2_MEDIA_PATH_REGEX = /^[^/]+\/(?:audio|video|photo)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[\w-]{1,10}$/

/** True iff `path` follows the R2 media-key convention. */
export function is_r2_media_path(path: string): boolean {
  return R2_MEDIA_PATH_REGEX.test(path)
}

/**
 * File extension from a storage path or file name: the `[\w-]{1,10}` suffix after
 * the final dot of the final segment (hyphens occur in the wild: `.x-m4a`).
 * Falls back to `bin` when there is no usable suffix.
 */
export function extract_media_extension(path: string): string {
  const last_segment = path.split('/').pop() ?? ''
  const match = last_segment.match(/\.(?<extension>[\w-]{1,10})$/)
  return match ? match.groups.extension.toLowerCase() : 'bin'
}

export function build_r2_media_key({ dict_id, kind, media_id, extension }: {
  dict_id: string
  kind: R2MediaKind
  media_id: string
  extension: string
}): string {
  return `${dict_id}/${kind}/${media_id}.${extension}`
}

/**
 * Photo VARIANTS (Phase 2): each photo original `{dict}/photo/{uuid}.{ext}` gets
 * three WebP renditions keyed `{dict}/photo/{uuid}_{variant}.webp`. Variant keys
 * deliberately do NOT match `is_r2_media_path` — only originals live in rows;
 * variant urls are derived at render time from the original key + a size spec.
 */
export const PHOTO_VARIANTS = ['thumb', 'w900', 'w1600'] as const
export type PhotoVariant = typeof PHOTO_VARIANTS[number]

export function photo_variant_key({ original_key, variant }: { original_key: string, variant: PhotoVariant }): string {
  return `${original_key.replace(/\.[\w-]{1,10}$/, '')}_${variant}.webp`
}

export function audio_playback_key({ original_key }: { original_key: string }): string {
  return `${original_key.replace(/\.[\w-]{1,10}$/, '')}_p1.mp3`
}

if (import.meta.vitest) {
  const uuid = '48af49b0-b410-4db1-babf-38ac53269e62'

  test('is_r2_media_path: accepts the new convention', () => {
    expect(is_r2_media_path(`achi/audio/${uuid}.mp3`)).toBe(true)
    expect(is_r2_media_path(`-runglwo/video/${uuid}.webm`)).toBe(true)
    expect(is_r2_media_path(`gta/photo/${uuid}.jpg`)).toBe(true)
    expect(is_r2_media_path(`gta/audio/${uuid}.x-m4a`)).toBe(true)
  })

  test('is_r2_media_path: rejects malformed or unsupported keys', () => {
    expect(is_r2_media_path('achi/audio/not-a-uuid.mp3')).toBe(false)
    expect(is_r2_media_path(`achi/audio/${uuid}/nested.mp3`)).toBe(false)
    expect(is_r2_media_path(`audio/achi/${uuid}.mp3`)).toBe(false)
    expect(is_r2_media_path(`achi/videos/${uuid}.mp4`)).toBe(false)
    expect(is_r2_media_path(`achi/images/${uuid}.jpg`)).toBe(false)
  })

  test(extract_media_extension, () => {
    expect(extract_media_extension('a/audio/x_123.wav')).toBe('wav')
    expect(extract_media_extension('audio/a/x.x-m4a')).toBe('x-m4a')
    expect(extract_media_extension('a/audio/UPPER.MP3')).toBe('mp3')
    expect(extract_media_extension('a/audio/no-extension')).toBe('bin')
    expect(extract_media_extension('a/audio/trailing.dot.')).toBe('bin')
  })

  test(build_r2_media_key, () => {
    expect(build_r2_media_key({ dict_id: 'achi', kind: 'audio', media_id: uuid, extension: 'mp3' }))
      .toBe(`achi/audio/${uuid}.mp3`)
  })

  test(photo_variant_key, () => {
    expect(photo_variant_key({ original_key: `gta/photo/${uuid}.jpg`, variant: 'thumb' }))
      .toBe(`gta/photo/${uuid}_thumb.webp`)
    expect(photo_variant_key({ original_key: `gta/photo/${uuid}.x-m4a`, variant: 'w900' }))
      .toBe(`gta/photo/${uuid}_w900.webp`)
  })

  test(audio_playback_key, () => {
    expect(audio_playback_key({ original_key: `gta/audio/${uuid}.x-m4a` })).toBe(`gta/audio/${uuid}_p1.mp3`)
  })

  test('variant keys never match is_r2_media_path (rows hold originals only)', () => {
    expect(is_r2_media_path(photo_variant_key({ original_key: `gta/photo/${uuid}.jpg`, variant: 'thumb' }))).toBe(false)
  })
}
