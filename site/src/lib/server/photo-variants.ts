import type { ResizeOptions } from 'sharp'
import sharp from 'sharp'
import type { PhotoVariant } from '$lib/utils/media-path'
import { photo_variant_key } from '$lib/utils/media-path'
import { record_media_object_by_key } from '$lib/db/server/media-ledger'
import { store_media_bytes } from './media-storage'
import { log_server_event } from './log-server-event'

/**
 * WebP variant generation for photos on the R2 key convention (Phase 2 decisions
 * 2026-07-23): thumb = 400px square crop (serves the s150-p/s340-p/s400-p specs),
 * w900 + w1600 width-capped, all WebP q80, never enlarged, EXIF-rotated (lh3 did
 * that for us before). Originals are stored untouched and serve `s0`.
 *
 * Upload flow calls `generate_and_store_photo_variants` WITHOUT awaiting (fire
 * after the original is stored, respond immediately — Jacob wants snappy). A
 * crash in the gap leaves original-without-variants, which the media reconcile
 * sweep detects and regenerates.
 */

const WEBP_QUALITY = 80

const RESIZE_BY_VARIANT: Record<PhotoVariant, ResizeOptions> = {
  thumb: { width: 400, height: 400, fit: 'cover', withoutEnlargement: true },
  w900: { width: 900, withoutEnlargement: true },
  w1600: { width: 1600, withoutEnlargement: true },
}

export async function generate_photo_variant({ bytes, variant }: { bytes: Uint8Array, variant: PhotoVariant }): Promise<Uint8Array> {
  return await sharp(bytes)
    .rotate() // apply EXIF orientation before stripping metadata
    .resize(RESIZE_BY_VARIANT[variant])
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()
}

/** Generate + store all three variants for an already-stored original. Returns per-variant byte sizes (for the media ledger). */
export async function generate_and_store_photo_variants({ original_key, bytes }: {
  original_key: string
  bytes: Uint8Array
}): Promise<{ key: string, bytes: number }[]> {
  const stored: { key: string, bytes: number }[] = []
  for (const variant of ['thumb', 'w900', 'w1600'] as const) {
    const variant_bytes = await generate_photo_variant({ bytes, variant })
    const key = photo_variant_key({ original_key, variant })
    await store_media_bytes({ file_name: key, file_type: 'image/webp', bytes: variant_bytes, r2_key: key })
    record_media_object_by_key({ key, bytes: variant_bytes.length })
    stored.push({ key, bytes: variant_bytes.length })
  }
  return stored
}

/** Fire-and-forget wrapper for the post-response path — logs instead of throwing. */
export function store_photo_variants_in_background(options: { original_key: string, bytes: Uint8Array }): void {
  generate_and_store_photo_variants(options).catch((err) => {
    console.error(`[photo-variants] generation failed for ${options.original_key}: ${err.message}`)
    log_server_event({ level: 'error', message: 'photo_variants_failed', error: err, context: { original_key: options.original_key } })
  })
}
