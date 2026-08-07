import type Database from 'better-sqlite3'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { parseBuffer } from 'music-metadata'
import { get_r2_media } from '$lib/server/r2-media'
import { read_photo_dimensions } from '$lib/server/photo-dimensions'
import { get_shared_db } from './shared-db'
import { set_media_object_metadata } from './media-ledger'

/**
 * Weekly-sweep companion: fill `media_objects` metadata still missing after the
 * upload-time fast paths (client-declared duration at presign, sharp dims in
 * photo-upload) — i.e. v1/agent uploads and files the browser couldn't decode.
 * Fetches originals back from R2 (audio avg ~200KB) and parses in-process:
 * music-metadata (pure JS) for audio/video duration, sharp for photo dims.
 */

const PROBE_CAP_PER_RUN = 500

export interface MediaMetadataProbeSummary {
  probed: number
  filled: number
  failures: number
}

export async function run_media_metadata_probe_once({ db = get_shared_db() }: {
  /** Ledger handle. The media-sweep CHILD passes its own (it must not call `get_shared_db`). */
  db?: Database.Database
} = {}): Promise<MediaMetadataProbeSummary> {
  const { client, bucket } = get_r2_media()
  const summary: MediaMetadataProbeSummary = { probed: 0, filled: 0, failures: 0 }

  const rows = db.prepare(`
    SELECT key, media_type FROM media_objects
    WHERE is_variant = 0 AND orphaned_at IS NULL AND (
      (media_type IN ('audio', 'video') AND duration_ms IS NULL)
      OR (media_type = 'photo' AND width IS NULL)
    )
    ORDER BY uploaded_at DESC LIMIT ?
  `).all(PROBE_CAP_PER_RUN) as { key: string, media_type: string }[]

  for (const row of rows) {
    summary.probed++
    try {
      const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: row.key }))
      const bytes = new Uint8Array(await object.Body.transformToByteArray())
      if (row.media_type === 'photo') {
        const dimensions = await read_photo_dimensions(bytes)
        if (!dimensions)
          throw new Error('undecodable image')
        set_media_object_metadata({ key: row.key, ...dimensions, db })
      } else {
        const { format } = await parseBuffer(bytes, { mimeType: object.ContentType }, { duration: true })
        if (!format.duration || !Number.isFinite(format.duration))
          throw new Error('no duration in parsed metadata')
        set_media_object_metadata({ key: row.key, duration_ms: Math.round(format.duration * 1000), db })
      }
      summary.filled++
    } catch (err) {
      summary.failures++
      console.error(`[media-sweep] metadata probe failed for ${row.key}: ${err.message}`)
    }
  }
  return summary
}
