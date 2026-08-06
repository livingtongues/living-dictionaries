import type { PhotoExif } from './photo-coords'
import { is_heic_bytes } from '$lib/api/v1/validate-media-bytes'
import { log_event } from '$lib/debug/remote-log'
import { normalize_photo_exif } from './photo-coords'

/**
 * Browser-side pre-flight for image uploads:
 *
 * 1. Reads EXIF GPS + capture time from the ORIGINAL file (before any
 *    conversion strips it) via a lazy-loaded exifr — blunted to village level.
 * 2. HEIC/HEIF (iPhone) → JPEG, so the no-HEIC bucket policy never has to
 *    reject a photo somebody actually took.
 *
 * THE HEIC CONVERSION IS A LADDER, cheapest rung first:
 *
 *   a. `createImageBitmap` — free, but ONLY Safari can decode HEIC this way.
 *   b. a WebAssembly libheif decoder, `import()`ed on demand.
 *
 * Rung (b) exists because of 2026-08-03: a contributor on Chrome for Android
 * made four HEIC uploads over eighty minutes and every one was rejected. Safari
 * users had never hit it, and the server can't decode HEVC-coded HEIC either
 * (its image library's only decodable HEIF flavour is `.avif`).
 *
 * THE WASM MUST NEVER LOAD FOR A NON-HEIC UPLOAD. It is ~3 MB of decoder, so it
 * is `import()`ed only after (i) a file has been chosen, (ii) its LEADING BYTES
 * sniff as HEIC — not its name or its declared type — and (iii) the free native
 * path has already failed. Somebody uploading a JPEG, and anybody on Safari,
 * downloads none of it.
 */
export async function prepare_image_upload(file: File | Blob): Promise<{ file: File | Blob, exif: PhotoExif }> {
  const exif = await read_exif(file)
  if (!await is_heic(file))
    return { file, exif }
  const converted = await convert_heic_to_jpeg(file)
  return { file: converted ?? file, exif }
}

/** Magic bytes first (catches a HEIC saved as `.jpg`), declared type / extension as the fallback. */
async function is_heic(file: File | Blob): Promise<boolean> {
  try {
    if (is_heic_bytes(new Uint8Array(await file.slice(0, 64).arrayBuffer())))
      return true
  } catch {
    // unreadable slice — fall through to the name/type check
  }
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

const JPEG_QUALITY = 0.9
/** `/api/photo-upload`'s ceiling. HEIC is ~2× denser than JPEG, so a legal HEIC can transcode past it. */
const MAX_UPLOAD_BYTES = 10_485_760
/** Longest edge we fall back to when quality alone can't get under the ceiling — still above `_w1600`. */
const SHRINK_LONGEST_EDGE = 2400

/**
 * Returns null only if BOTH rungs fail — then the original is uploaded and the
 * server's transcode-or-reject net answers with a sentence the person now
 * actually sees (`upload-media.ts` surfaces the response body).
 */
async function convert_heic_to_jpeg(file: File | Blob): Promise<File | null> {
  const started = performance.now()
  try {
    const converted = await shrink_to_fit(await convert_via_bitmap(file))
    log_heic_conversion({ file, decoder: 'native', started, converted })
    return converted
  } catch {
    // Every non-Safari browser lands here — expected, not an error.
  }
  try {
    // THE ONLY PLACE THE DECODER IS LOADED. Split into its own chunk by this
    // dynamic import; nothing above ever touches it.
    const { heicTo } = await import('heic-to')
    const blob = await heicTo({ blob: file instanceof File ? file : new File([file], 'photo.heic', { type: 'image/heic' }), type: 'image/jpeg', quality: JPEG_QUALITY })
    const converted = await shrink_to_fit(new File([blob], jpeg_name(file), { type: 'image/jpeg' }))
    log_heic_conversion({ file, decoder: 'wasm', started, converted })
    return converted
  } catch (error) {
    log_event({
      level: 'warn',
      message: 'heic_conversion_failed',
      context: { bytes: file.size, mimetype: file.type || null, error_message: (error as Error)?.message?.slice(0, 300) ?? null },
    })
    return null
  }
}

function log_heic_conversion({ file, decoder, started, converted }: {
  file: File | Blob
  decoder: 'native' | 'wasm'
  started: number
  converted?: File
}): void {
  log_event({
    level: 'info',
    message: 'heic_converted',
    context: { decoder, bytes_in: file.size, bytes_out: converted?.size ?? null, duration_ms: Math.round(performance.now() - started) },
  })
}

/**
 * Keep the transcoded JPEG under the upload endpoint's ceiling: quality first,
 * then a resize. Every browser can decode the JPEG we just produced, so this
 * needs no decoder. A no-op for the overwhelming majority of photos.
 */
async function shrink_to_fit(file: File): Promise<File> {
  if (file.size <= MAX_UPLOAD_BYTES)
    return file
  for (const { quality, longest_edge } of [{ quality: 0.75, longest_edge: 0 }, { quality: 0.75, longest_edge: SHRINK_LONGEST_EDGE }]) {
    const smaller = await re_encode({ file, quality, longest_edge }).catch(() => null)
    if (smaller && smaller.size <= MAX_UPLOAD_BYTES)
      return smaller
  }
  return file // let the server say no — better than silently uploading mush
}

async function re_encode({ file, quality, longest_edge }: { file: File, quality: number, longest_edge: number }): Promise<File> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = longest_edge > 0 ? Math.min(1, longest_edge / Math.max(bitmap.width, bitmap.height)) : 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob)
      throw new Error('canvas toBlob returned null')
    return new File([blob], file.name, { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}

async function convert_via_bitmap(file: File | Blob): Promise<File> {
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    canvas.getContext('2d').drawImage(bitmap, 0, 0)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob)
      throw new Error('canvas toBlob returned null')
    return new File([blob], jpeg_name(file), { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}

function jpeg_name(file: File | Blob): string {
  const base_name = file instanceof File ? file.name.replace(/\.[^.]+$/, '') : 'photo'
  return `${base_name}.jpg`
}
