/**
 * Stage 2: copy every pending object to the LD media bucket (additive — nothing
 * user-visible changes until the rewrite stage).
 *
 * Source order per object:
 *   1. poly R2 mirror `backups-rolling/mirror/gcs-living/{old_path}` (free egress;
 *      safe because media objects are never rewritten in place at source)
 *   2. public firebasestorage `?alt=media` URL (objects uploaded since the last
 *      weekly mirror run)
 * Neither has it → status 'missing' (row keeps its old path forever; no rewrite).
 *
 * Restartable: only 'pending'/'error' rows are attempted; re-PUT is harmless.
 *
 * Usage: pnpm tsx media-migration/copy.ts [--dict=<id>] [--limit=N]
 */
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { photo_variant_key, PHOTO_VARIANTS } from '../../site/src/lib/utils/media-path'
import { get_ld_r2_client, get_poly_r2_client, get_state_db, gcs_public_url, iso_now, MEDIA_BUCKET, MIRROR_BUCKET, MIRROR_PREFIX } from './lib'

const CONCURRENCY = 12

/** Photo-kind state tables — originals get the WebP variant set generated locally. */
export const PHOTO_TABLES = new Set(['photos', 'partner_logos', 'featured_image'])

interface StateRow { dict_id: string, tbl: string, row_id: string, old_path: string, new_key: string }

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  'mp3': 'audio/mpeg',
  'mpeg': 'audio/mpeg',
  'wav': 'audio/wav',
  'm4a': 'audio/mp4',
  'x-m4a': 'audio/mp4',
  'ogg': 'audio/ogg',
  'webm': 'video/webm',
  'mp4': 'video/mp4',
  'mov': 'video/quicktime',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
  'gif': 'image/gif',
}

// Mirrors site/src/lib/server/photo-variants.ts (thumb 400 square / w900 / w1600, WebP q80).
const RESIZE_BY_VARIANT = {
  thumb: { width: 400, height: 400, fit: 'cover' as const, withoutEnlargement: true },
  w900: { width: 900, withoutEnlargement: true },
  w1600: { width: 1600, withoutEnlargement: true },
}

async function fetch_source({ poly, row }: { poly: ReturnType<typeof get_poly_r2_client>, row: StateRow }): Promise<{ bytes: Buffer, content_type: string | null, source: 'mirror' | 'gcs' | 'lh3' } | null> {
  // No storage_path at source — original pulled from the lh3 CDN at full size.
  if (row.old_path.startsWith('lh3:')) {
    const response = await fetch(`https://lh3.googleusercontent.com/${row.old_path.slice(4)}=s0`)
    if (response.status === 404 || response.status === 400)
      return null
    if (!response.ok)
      throw new Error(`lh3 fetch ${response.status} for ${row.old_path}`)
    return { bytes: Buffer.from(await response.arrayBuffer()), content_type: response.headers.get('content-type'), source: 'lh3' }
  }
  try {
    const result = await poly.send(new GetObjectCommand({ Bucket: MIRROR_BUCKET, Key: `${MIRROR_PREFIX}${row.old_path}` }))
    const bytes = Buffer.from(await result.Body.transformToByteArray())
    return { bytes, content_type: result.ContentType ?? null, source: 'mirror' }
  } catch (err) {
    if (err.name !== 'NoSuchKey' && err.$metadata?.httpStatusCode !== 404)
      throw err
  }
  const response = await fetch(gcs_public_url(row.old_path))
  if (response.status === 404)
    return null
  if (!response.ok)
    throw new Error(`gcs fetch ${response.status} for ${row.old_path}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  return { bytes, content_type: response.headers.get('content-type'), source: 'gcs' }
}

async function main() {
  const dict_filter = process.argv.find(a => a.startsWith('--dict='))?.slice(7)
  const limit = Number(process.argv.find(a => a.startsWith('--limit='))?.slice(8) ?? 0)

  const db = get_state_db()
  const rows = db.prepare(`
    SELECT dict_id, tbl, row_id, old_path, new_key FROM objects
    WHERE status IN ('pending', 'error') ${dict_filter ? 'AND dict_id = ?' : ''}
    ORDER BY dict_id ${limit ? `LIMIT ${limit}` : ''}
  `).all(...dict_filter ? [dict_filter] : []) as StateRow[]
  console.log(`${rows.length} objects to copy.`)
  if (!rows.length)
    return

  const poly = get_poly_r2_client()
  const ld = await get_ld_r2_client()
  const mark_copied = db.prepare(`UPDATE objects SET status = 'copied', bytes = ?, content_type = ?, source = ?, error = NULL, copied_at = ? WHERE tbl = ? AND row_id = ?`)
  const mark_missing = db.prepare(`UPDATE objects SET status = 'missing', error = NULL, copied_at = ? WHERE tbl = ? AND row_id = ?`)
  const mark_error = db.prepare(`UPDATE objects SET status = 'error', error = ? WHERE tbl = ? AND row_id = ?`)
  const record_variant = db.prepare(`
    INSERT INTO variants (tbl, row_id, variant, key, bytes) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (tbl, row_id, variant) DO UPDATE SET key = excluded.key, bytes = excluded.bytes
  `)

  let done = 0
  let copied = 0
  let missing = 0
  let errored = 0
  let copied_bytes = 0
  const started = Date.now()
  let next_index = 0

  async function worker() {
    while (next_index < rows.length) {
      const row = rows[next_index++]
      try {
        const source = await fetch_source({ poly, row })
        if (!source) {
          mark_missing.run(iso_now(), row.tbl, row.row_id)
          missing++
        } else {
          const extension = row.new_key.split('.').pop()
          const content_type = source.content_type && source.content_type !== 'application/octet-stream'
            ? source.content_type
            : (EXTENSION_CONTENT_TYPES[extension] ?? source.content_type ?? 'application/octet-stream')
          // Photo-kind: generate ALL variants BEFORE any PUT — a sharp failure
          // (corrupt/unsupported source) errors the whole row so it keeps lh3.
          const variant_puts: { variant: string, key: string, bytes: Buffer }[] = []
          if (PHOTO_TABLES.has(row.tbl)) {
            for (const variant of PHOTO_VARIANTS) {
              const bytes = await sharp(source.bytes).rotate().resize(RESIZE_BY_VARIANT[variant]).webp({ quality: 80 }).toBuffer()
              variant_puts.push({ variant, key: photo_variant_key({ original_key: row.new_key, variant }), bytes })
            }
          }
          await ld.send(new PutObjectCommand({
            Bucket: MEDIA_BUCKET,
            Key: row.new_key,
            Body: source.bytes,
            ContentType: content_type,
            CacheControl: 'public, max-age=31536000, immutable',
          }))
          for (const put of variant_puts) {
            await ld.send(new PutObjectCommand({
              Bucket: MEDIA_BUCKET,
              Key: put.key,
              Body: put.bytes,
              ContentType: 'image/webp',
              CacheControl: 'public, max-age=31536000, immutable',
            }))
            record_variant.run(row.tbl, row.row_id, put.variant, put.key, put.bytes.length)
            copied_bytes += put.bytes.length
          }
          mark_copied.run(source.bytes.length, content_type, source.source, iso_now(), row.tbl, row.row_id)
          copied++
          copied_bytes += source.bytes.length
        }
      } catch (err) {
        mark_error.run(String(err?.message ?? err), row.tbl, row.row_id)
        errored++
      }
      done++
      if (done % 500 === 0) {
        const rate = done / ((Date.now() - started) / 1000)
        console.log(`${done}/${rows.length} (${copied} copied ${(copied_bytes / 1e9).toFixed(2)}GB, ${missing} missing, ${errored} errors) — ${rate.toFixed(1)}/s`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  console.log(`DONE: ${copied} copied (${(copied_bytes / 1e9).toFixed(2)}GB), ${missing} missing, ${errored} errors, in ${((Date.now() - started) / 60000).toFixed(1)} min`)
  const by_source = db.prepare(`SELECT source, COUNT(*) c FROM objects WHERE status = 'copied' GROUP BY source`).all()
  console.log('By source:', by_source)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
