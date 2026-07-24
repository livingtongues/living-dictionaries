import type { PhotoExif } from './photo-coords'
import { normalize_photo_exif } from './photo-coords'

/**
 * Browser-side pre-flight for image uploads:
 *
 * 1. Reads EXIF GPS + capture time from the ORIGINAL file (before any
 *    conversion strips it) via a lazy-loaded exifr — blunted to village level.
 * 2. HEIC/HEIF (iPhone) → converts to JPEG through canvas. Safari decodes HEIC
 *    natively — which is strictly more reliable than server libheif on real
 *    iPhone HDR/Live-Photo files (they routinely trip its iref security limit).
 *    Non-Safari browsers can't decode HEIC; conversion fails and we upload the
 *    original so the server's transcode-or-reject net can respond clearly.
 */
export async function prepare_image_upload(file: File | Blob): Promise<{ file: File | Blob, exif: PhotoExif }> {
  const exif = await read_exif(file)
  if (!is_heic(file))
    return { file, exif }
  const converted = await convert_to_jpeg(file).catch(() => null)
  return { file: converted ?? file, exif }
}

function is_heic(file: File | Blob): boolean {
  const type = file.type.toLowerCase()
  if (type === 'image/heic' || type === 'image/heif' || type === 'image/heic-sequence' || type === 'image/heif-sequence')
    return true
  const name = file instanceof File ? file.name.toLowerCase() : ''
  return name.endsWith('.heic') || name.endsWith('.heif')
}

async function read_exif(file: File | Blob): Promise<PhotoExif> {
  try {
    const exifr = (await import('exifr')).default
    const [gps, tags] = await Promise.all([
      exifr.gps(file).catch(() => null),
      exifr.parse(file, ['DateTimeOriginal', 'CreateDate']).catch(() => null),
    ])
    return normalize_photo_exif({
      latitude: gps?.latitude ?? null,
      longitude: gps?.longitude ?? null,
      taken_at: (tags?.DateTimeOriginal ?? tags?.CreateDate ?? null) as Date | null,
    })
  } catch {
    return {}
  }
}

async function convert_to_jpeg(file: File | Blob): Promise<File> {
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d').drawImage(bitmap, 0, 0)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob)
      throw new Error('canvas toBlob returned null')
    const base_name = file instanceof File ? file.name.replace(/\.[^.]+$/, '') : 'photo'
    return new File([blob], `${base_name}.jpg`, { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}
