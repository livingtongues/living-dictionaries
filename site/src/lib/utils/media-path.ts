/**
 * Pure storage-path helpers shared by the app AND the GCS→R2 migration driver
 * (`scripts/media-migration/` imports this file relatively — keep it free of
 * `$lib`/`$env` imports).
 *
 * NEW R2 key convention: `{dict_id}/{audio|video|photo}/{media_row_id}.{ext}`
 * (media row ids are crypto.randomUUID, minted BEFORE upload).
 *
 * OLD GCS paths (prod survey 2026-07-23, 146k rows) are a mess of shapes:
 *   `{dict}/audio/{owner}/{ts}.wav` · `{dict}/audio/{id}_{ts}.wav` (3 segments —
 *   so segment COUNT alone cannot discriminate!) · `audio/{dict}/{id}_{ts}.mpeg`
 *   · extensions with hyphens (`.x-m4a`). The reliable discriminator is the
 *   UUID filename: old filenames always carry `_{ts}` or are bare timestamps,
 *   never exactly `{uuid}.{ext}`.
 */

export const R2_MEDIA_KINDS = ['audio', 'video', 'photo'] as const
export type R2MediaKind = typeof R2_MEDIA_KINDS[number]

const R2_MEDIA_PATH_REGEX = /^[^/]+\/(?:audio|video|photo)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[\w-]{1,10}$/

/** True iff `path` follows the NEW R2 key convention (serve from the R2 media domain, not GCS/lh3). */
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

/**
 * Map an lh3 size spec (the part after `=` in legacy serving urls — mostly
 * `s150-p s340-p s400-p w900 w1200 w1600 s0`, plus dynamic `w{N}`/`h{N}` from
 * the image viewers) onto the fixed variant set. `null` = untouched original.
 */
export function variant_for_size_spec(size: string): PhotoVariant | null {
  if (size === 's0')
    return null
  const match = size.match(/^([swh])(\d+)/)
  if (!match)
    return null
  const [, dimension_kind, raw] = match
  const pixels = Number(raw)
  if (dimension_kind === 's' && pixels <= 400)
    return 'thumb'
  return pixels <= 900 ? 'w900' : 'w1600'
}

if (import.meta.vitest) {
  const uuid = '48af49b0-b410-4db1-babf-38ac53269e62'

  test('is_r2_media_path: accepts the new convention', () => {
    expect(is_r2_media_path(`achi/audio/${uuid}.mp3`)).toBe(true)
    expect(is_r2_media_path(`-runglwo/video/${uuid}.webm`)).toBe(true)
    expect(is_r2_media_path(`gta/photo/${uuid}.jpg`)).toBe(true)
    expect(is_r2_media_path(`gta/audio/${uuid}.x-m4a`)).toBe(true)
  })

  test('is_r2_media_path: rejects every old GCS shape (incl. the 46k 3-segment old audio paths)', () => {
    expect(is_r2_media_path('a-fala/audio/60220e8c-9862-40b5-ab6c-fa559841b0d1_1780419808946.wav')).toBe(false)
    expect(is_r2_media_path(`-runglwo/audio/${uuid}/1735716878714.wav`)).toBe(false)
    expect(is_r2_media_path('audio/dict_80CcDQ4DRyiYSPIWZ9Hy/IHQSYzL4JwEmqcJQ64xy_1566797987964.mpeg')).toBe(false)
    expect(is_r2_media_path('arvanitika/audio/d1jImgXoZsEPwxEQfPaD_1689614710655.x-m4a')).toBe(false)
    expect(is_r2_media_path('chikunda/videos/0HEnsXumMo5QXAmlTvI0_1676752690966.mp4')).toBe(false)
    expect(is_r2_media_path(`achi/images/${uuid}.jpg`)).toBe(false) // old photo folder word
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

  test('variant keys never match is_r2_media_path (rows hold originals only)', () => {
    expect(is_r2_media_path(photo_variant_key({ original_key: `gta/photo/${uuid}.jpg`, variant: 'thumb' }))).toBe(false)
  })

  test('variant_for_size_spec: maps all 7 lh3 specs the app uses', () => {
    expect(variant_for_size_spec('s150-p')).toBe('thumb')
    expect(variant_for_size_spec('s340-p')).toBe('thumb')
    expect(variant_for_size_spec('s400-p')).toBe('thumb')
    expect(variant_for_size_spec('w900')).toBe('w900')
    expect(variant_for_size_spec('w1200')).toBe('w1600')
    expect(variant_for_size_spec('w1600')).toBe('w1600')
    expect(variant_for_size_spec('s0')).toBe(null)
    expect(variant_for_size_spec('garbage')).toBe(null)
  })
}
