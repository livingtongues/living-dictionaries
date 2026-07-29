import sharp from 'sharp'

/** EXIF-orientation-corrected pixel dimensions (as the photo displays) — null on undecodable bytes, never throws. */
export async function read_photo_dimensions(bytes: Uint8Array): Promise<{ width: number, height: number } | null> {
  try {
    const { width, height, orientation } = await sharp(bytes).metadata()
    if (!width || !height)
      return null
    const rotated = (orientation ?? 1) >= 5
    return rotated ? { width: height, height: width } : { width, height }
  } catch {
    return null
  }
}
