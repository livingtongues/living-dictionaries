import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { photo_variant_key } from '$lib/utils/media-path'
import { record_media_object_by_key } from '$lib/db/server/media-ledger'
import { generate_photo_variant } from './photo-variants'
import { store_media_bytes } from './media-storage'
import { get_r2_media, r2_media_is_configured } from './r2-media'
import { log_server_event } from './log-server-event'

/**
 * Video THUMBNAIL generation (mirrors `photo-variants.ts`): extract one frame
 * with ffmpeg, then run it through the SAME `generate_photo_variant('thumb')`
 * pipeline (400px square-crop WebP q80) so an uploaded video's `_thumb.webp`
 * sibling is byte-for-byte the same shape as a photo thumb. `video_thumb_src`
 * derives the url from the original `storage_path` — nothing else stored.
 *
 * Unlike photos (whose bytes POST to our server), browser video uploads presign
 * straight to R2, so the server never holds the bytes at upload time. Two entry
 * points cover that: the fast path fired after the row saves
 * (`/api/video/generate-thumbnail`) and the media sweep's weekly self-heal both
 * call {@link generate_and_store_video_thumbnail} with NO bytes → it fetches the
 * object back from R2. The v1 agent path already has the bytes, so it passes them.
 *
 * REQUIRES `ffmpeg` on PATH (installed in the Docker runner stage). Absent →
 * generation returns null and the render side falls back to the play-icon chip.
 */

const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg'
/** Seek a second in first — the opening frame is often black / a fade-in. */
const PRIMARY_SEEK_SECONDS = 1

function run_ffmpeg(args: string[]): Promise<{ ok: boolean }> {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG_BIN, ['-nostdin', '-loglevel', 'error', ...args])
    proc.on('close', code => resolve({ ok: code === 0 }))
    proc.on('error', () => resolve({ ok: false }))
  })
}

async function extract_frame({ input_path, seek_seconds, out_path }: {
  input_path: string
  seek_seconds: number
  out_path: string
}): Promise<Uint8Array | null> {
  // Fast (keyframe) seek before -i — fine for a thumbnail; -frames:v 1 grabs one frame.
  const { ok } = await run_ffmpeg(['-ss', String(seek_seconds), '-i', input_path, '-frames:v', '1', '-f', 'image2', '-y', out_path])
  if (!ok)
    return null
  try {
    const bytes = new Uint8Array(await readFile(out_path))
    return bytes.length ? bytes : null
  } catch {
    return null
  }
}

/** Extract a representative frame and render it as a `thumb` WebP. Null if ffmpeg can't produce a frame. */
export async function generate_video_thumbnail({ bytes }: { bytes: Uint8Array }): Promise<Uint8Array | null> {
  const dir = await mkdtemp(join(tmpdir(), 'ld-video-thumb-'))
  try {
    const input_path = join(dir, 'input')
    await writeFile(input_path, bytes)
    // 1s in, then fall back to the very first frame for ultra-short clips.
    for (const seek_seconds of [PRIMARY_SEEK_SECONDS, 0]) {
      const frame = await extract_frame({ input_path, seek_seconds, out_path: join(dir, `frame-${seek_seconds}.png`) })
      if (frame)
        return await generate_photo_variant({ bytes: frame, variant: 'thumb' })
    }
    return null
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * Generate + store the `_thumb.webp` for an uploaded video original. Pass `bytes`
 * when they're already in hand (v1 upload); otherwise the object is fetched back
 * from R2 (browser-upload fast path + sweep self-heal). Returns the stored key +
 * size, or null when no thumbnail could be produced (skipped in dev with no R2).
 */
export async function generate_and_store_video_thumbnail({ original_key, bytes }: {
  original_key: string
  bytes?: Uint8Array
}): Promise<{ key: string, bytes: number } | null> {
  let video_bytes = bytes
  if (!video_bytes) {
    if (!r2_media_is_configured())
      return null
    const { client, bucket } = get_r2_media()
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: original_key }))
    video_bytes = new Uint8Array(await object.Body.transformToByteArray())
  }
  const thumb = await generate_video_thumbnail({ bytes: video_bytes })
  if (!thumb)
    return null
  const key = photo_variant_key({ original_key, variant: 'thumb' })
  await store_media_bytes({ file_type: 'image/webp', bytes: thumb, r2_key: key })
  record_media_object_by_key({ key, bytes: thumb.length })
  return { key, bytes: thumb.length }
}

/** Fire-and-forget wrapper for the post-response / post-upload path — logs instead of throwing. */
export function store_video_thumbnail_in_background(options: { original_key: string, bytes?: Uint8Array }): void {
  generate_and_store_video_thumbnail(options).catch((err) => {
    console.error(`[video-thumbnails] generation failed for ${options.original_key}: ${err.message}`)
    log_server_event({ level: 'error', message: 'video_thumbnail_failed', error: err, context: { original_key: options.original_key } })
  })
}
