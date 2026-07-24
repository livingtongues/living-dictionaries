import sharp from 'sharp'

/**
 * Best-effort server-side HEIC→JPEG net for the browser upload path. Safari
 * converts HEIC client-side BEFORE upload (see `prepare_image_upload`), so this
 * only runs for the rare non-Safari-with-a-HEIC case. `unlimited` lifts
 * libheif's iref security limit (real iPhone HDR/Live-Photo files exceed it);
 * gnarly gain-map files can still fail — the caller rejects with a clear
 * message instead of storing an undisplayable original.
 */
export async function transcode_image_to_jpeg(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    return await sharp(bytes, { unlimited: true })
      .rotate() // EXIF orientation is stripped with the rest of the metadata
      .jpeg({ quality: 90 })
      .toBuffer()
  } catch {
    return null
  }
}
