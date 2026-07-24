import exifr from 'exifr'
import type { PhotoExif } from '$lib/media/photo-coords'
import { normalize_photo_exif } from '$lib/media/photo-coords'

/**
 * Read GPS + capture time out of original photo bytes (JPEG/HEIC/PNG/WebP…)
 * server-side. Never throws — EXIF is best-effort; coordinates are blunted to
 * village level by `normalize_photo_exif` before anything is returned.
 */
export async function extract_photo_exif(bytes: Uint8Array): Promise<PhotoExif> {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const [gps, tags] = await Promise.all([
    exifr.gps(buffer).catch(() => null),
    exifr.parse(buffer, ['DateTimeOriginal', 'CreateDate']).catch(() => null),
  ])
  return normalize_photo_exif({
    latitude: gps?.latitude ?? null,
    longitude: gps?.longitude ?? null,
    taken_at: (tags?.DateTimeOriginal ?? tags?.CreateDate ?? null) as Date | null,
  })
}
