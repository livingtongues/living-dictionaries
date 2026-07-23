/**
 * Repair the handful of photo rows that failed the copy stage (sharp couldn't
 * decode the source). These are iPhone HEICs that trip libheif's iref-16 security
 * limit (36–48 refs — HDR/Live-Photo gain-map images) plus the odd truncated JPEG.
 *
 * Jacob's directive (2026-07-23): NO HEIC ever lands in the R2 bucket — every
 * stored original must be a standard web format. lh3 already transcoded these to
 * JPEG for the live app, so we pull the original via the lh3 `=s0` url (Google's
 * decoder handles the gnarly gain-map HEICs our sharp can't), sharp-normalize to
 * JPEG, store under a `.jpg` key, and generate the 3 WebP variants.
 *
 * Fallback if lh3 has no copy: the poly mirror bytes through
 * `sharp(bytes, { failOn:'none', unlimited:true })` (rescues truncated JPEGs).
 *
 * Idempotent: only touches status='error' rows; re-run freely.
 *
 * Usage: pnpm tsx media-migration/fix-error-photos.ts
 */
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { photo_variant_key, PHOTO_VARIANTS } from '../../site/src/lib/utils/media-path'
import { docker_exec_node, get_ld_r2_client, get_poly_r2_client, get_state_db, iso_now, MEDIA_BUCKET, MIRROR_BUCKET, MIRROR_PREFIX } from './lib'

// Mirrors copy.ts / site photo-variants.ts (thumb 400 square / w900 / w1600, WebP q80).
const RESIZE_BY_VARIANT = {
  thumb: { width: 400, height: 400, fit: 'cover' as const, withoutEnlargement: true },
  w900: { width: 900, withoutEnlargement: true },
  w1600: { width: 1600, withoutEnlargement: true },
}

interface ErrorRow { dict_id: string, tbl: string, row_id: string, old_path: string, new_key: string, error: string }

/** Pull each error row's lh3 serving hash from prod (photos / partner logos / featured image). */
function build_serving_url_collector(rows: ErrorRow[]): string {
  return `
const Database = require('better-sqlite3')
const rows = ${JSON.stringify(rows.map(r => ({ dict_id: r.dict_id, tbl: r.tbl, row_id: r.row_id })))}
const out = {}
const shared = new Database('/data/shared.db', { readonly: true })
for (const r of rows) {
  const key = r.tbl + ':' + r.row_id
  try {
    if (r.tbl === 'photos') {
      const db = new Database('/data/dictionaries/' + r.dict_id + '.db', { readonly: true })
      const row = db.prepare('SELECT serving_url FROM photos WHERE id = ?').get(r.row_id)
      db.close()
      out[key] = row?.serving_url ?? null
    } else if (r.tbl === 'partner_logos') {
      const row = shared.prepare('SELECT photo_serving_url FROM dictionary_partners WHERE id = ?').get(r.row_id)
      out[key] = row?.photo_serving_url ?? null
    } else if (r.tbl === 'featured_image') {
      const row = shared.prepare('SELECT featured_image FROM dictionaries WHERE id = ?').get(r.row_id)
      let image = null
      try { image = JSON.parse(row?.featured_image ?? 'null') } catch {}
      out[key] = image?.serving_url ?? null
    }
  } catch (err) { out[key] = null }
}
shared.close()
console.log(JSON.stringify(out))
`
}

const WEB_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif'])
const FORMAT_CONTENT_TYPE: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }

/** True when sharp genuinely can't decode the source (HEIC iref limit / gain-map / truncation). */
function needs_transcode(error: string): boolean {
  return /heif|bad seek|premature end|corrupt header/i.test(error)
}

async function fetch_lh3_original(serving_url: string): Promise<Buffer | null> {
  const hash = serving_url.replace('\n', '').trim()
  const response = await fetch(`https://lh3.googleusercontent.com/${hash}=s0`)
  if (!response.ok)
    return null
  return Buffer.from(await response.arrayBuffer())
}

async function fetch_mirror_bytes(poly: ReturnType<typeof get_poly_r2_client>, old_path: string): Promise<Buffer | null> {
  try {
    const result = await poly.send(new GetObjectCommand({ Bucket: MIRROR_BUCKET, Key: `${MIRROR_PREFIX}${old_path}` }))
    return Buffer.from(await result.Body.transformToByteArray())
  } catch {
    return null
  }
}

async function make_variants(original: Buffer): Promise<{ variant: string, bytes: Buffer }[]> {
  return await Promise.all(PHOTO_VARIANTS.map(async (variant) => {
    const bytes = await sharp(original, { failOn: 'none' }).rotate().resize(RESIZE_BY_VARIANT[variant]).webp({ quality: 80 }).toBuffer()
    return { variant, bytes }
  }))
}

async function main() {
  const db = get_state_db()
  const rows = db.prepare(`SELECT dict_id, tbl, row_id, old_path, new_key, error FROM objects WHERE status = 'error'`).all() as ErrorRow[]
  console.log(`${rows.length} error rows to repair.`)
  if (!rows.length)
    return

  console.log('Collecting lh3 serving urls from prod...')
  const serving_map = JSON.parse(await docker_exec_node({ program: build_serving_url_collector(rows) })) as Record<string, string | null>

  const poly = get_poly_r2_client()
  const ld = await get_ld_r2_client()
  const mark_copied = db.prepare(`UPDATE objects SET status = 'copied', bytes = ?, content_type = ?, source = ?, new_key = ?, error = NULL, copied_at = ? WHERE tbl = ? AND row_id = ?`)
  const mark_error = db.prepare(`UPDATE objects SET error = ? WHERE tbl = ? AND row_id = ?`)
  const record_variant = db.prepare(`
    INSERT INTO variants (tbl, row_id, variant, key, bytes) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (tbl, row_id, variant) DO UPDATE SET key = excluded.key, bytes = excluded.bytes
  `)

  let fixed_verbatim = 0
  let fixed_transcode = 0
  for (const row of rows) {
    try {
      const serving_url = serving_map[`${row.tbl}:${row.row_id}`]
      let original: Buffer | null = null
      let new_key = row.new_key
      let content_type = ''
      let source = ''

      // Path A — decodable web-format JPEG that sharp only rejected on a strict
      // `failOn` warning (Invalid SOS / ASCII marker). Store the ORIGINAL bytes
      // verbatim (no lossy re-encode); variants come off it with failOn:'none'.
      if (!needs_transcode(row.error)) {
        const mirror_bytes = await fetch_mirror_bytes(poly, row.old_path)
        if (mirror_bytes) {
          const meta = await sharp(mirror_bytes, { failOn: 'none' }).metadata().catch(() => null)
          if (meta && WEB_FORMATS.has(meta.format)) {
            original = mirror_bytes
            content_type = FORMAT_CONTENT_TYPE[meta.format]
            source = 'mirror-verbatim'
          }
        }
      }

      // Path B — HEIC / gain-map / truncated: transcode a clean JPEG. lh3 `=s0`
      // (Google already decoded these for the live app) is primary; a last-ditch
      // mirror decode with all limits off rescues the rest.
      if (!original && serving_url) {
        const lh3_bytes = await fetch_lh3_original(serving_url)
        if (lh3_bytes) {
          original = await sharp(lh3_bytes, { failOn: 'none' }).rotate().jpeg({ quality: 85 }).toBuffer()
          new_key = row.new_key.replace(/\.[\w-]{1,10}$/, '.jpg')
          content_type = 'image/jpeg'
          source = 'lh3'
        }
      }
      if (!original) {
        const mirror_bytes = await fetch_mirror_bytes(poly, row.old_path)
        if (mirror_bytes) {
          original = await sharp(mirror_bytes, { failOn: 'none', unlimited: true }).rotate().jpeg({ quality: 85 }).toBuffer()
          new_key = row.new_key.replace(/\.[\w-]{1,10}$/, '.jpg')
          content_type = 'image/jpeg'
          source = 'mirror-transcode'
        }
      }
      if (!original) {
        mark_error.run(`repair failed: no decodable source (lh3=${serving_url ? 'present' : 'none'})`, row.tbl, row.row_id)
        console.log(`✗ ${row.tbl}:${row.row_id} (${row.dict_id}) — no decodable source`)
        continue
      }

      // Variants first (a failure here keeps the row 'error' — never a half object set).
      const variants = await make_variants(original)

      await ld.send(new PutObjectCommand({
        Bucket: MEDIA_BUCKET,
        Key: new_key,
        Body: original,
        ContentType: content_type,
        CacheControl: 'public, max-age=31536000, immutable',
      }))
      for (const put of variants) {
        const key = photo_variant_key({ original_key: new_key, variant: put.variant })
        await ld.send(new PutObjectCommand({
          Bucket: MEDIA_BUCKET,
          Key: key,
          Body: put.bytes,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }))
        record_variant.run(row.tbl, row.row_id, put.variant, key, put.bytes.length)
      }
      mark_copied.run(original.length, content_type, source, new_key, iso_now(), row.tbl, row.row_id)
      if (source.startsWith('mirror-verbatim'))
        fixed_verbatim++
      else
        fixed_transcode++
      console.log(`✓ ${row.tbl}:${row.row_id} (${row.dict_id}) via ${source} → ${new_key} (${(original.length / 1024).toFixed(0)}KB + 3 variants)`)
    } catch (err) {
      mark_error.run(`repair error: ${String(err?.message ?? err)}`, row.tbl, row.row_id)
      console.log(`✗ ${row.tbl}:${row.row_id} (${row.dict_id}) — ${err?.message ?? err}`)
    }
  }
  const fixed = fixed_verbatim + fixed_transcode
  console.log(`Repaired ${fixed_verbatim} verbatim + ${fixed_transcode} transcoded.`)
  console.log(`DONE: ${fixed}/${rows.length} repaired.`)
  const remaining = db.prepare(`SELECT COUNT(*) c FROM objects WHERE status = 'error'`).get() as { c: number }
  console.log(`${remaining.c} still in error.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
