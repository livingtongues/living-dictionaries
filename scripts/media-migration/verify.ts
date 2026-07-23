/**
 * Stage 3: per-dict verification — list the media bucket's `{dict}/audio/` +
 * `{dict}/video/` prefixes and require every state row marked 'copied' to exist
 * with the exact recorded byte size. Fully-clean dicts get `dicts.verified_at`
 * (the rewrite stage refuses dicts without it).
 *
 * Usage: pnpm tsx media-migration/verify.ts [--dict=<id>]
 */
import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import { get_ld_r2_client, get_state_db, iso_now, MEDIA_BUCKET } from './lib'

async function list_prefix(client: Awaited<ReturnType<typeof get_ld_r2_client>>, prefix: string): Promise<Map<string, number>> {
  const keys = new Map<string, number>()
  let token: string | undefined
  do {
    const result = await client.send(new ListObjectsV2Command({ Bucket: MEDIA_BUCKET, Prefix: prefix, ContinuationToken: token }))
    for (const object of result.Contents ?? [])
      keys.set(object.Key, object.Size)
    token = result.IsTruncated ? result.NextContinuationToken : undefined
  } while (token)
  return keys
}

async function main() {
  const dict_filter = process.argv.find(a => a.startsWith('--dict='))?.slice(7)
  const db = get_state_db()
  const dicts = db.prepare(`
    SELECT DISTINCT dict_id FROM objects WHERE status = 'copied' ${dict_filter ? 'AND dict_id = ?' : ''} ORDER BY dict_id
  `).all(...dict_filter ? [dict_filter] : []) as { dict_id: string }[]
  console.log(`Verifying ${dicts.length} dicts...`)

  const client = await get_ld_r2_client()
  const get_rows = db.prepare(`SELECT tbl, row_id, new_key, bytes, status FROM objects WHERE dict_id = ?`)
  const get_variants = db.prepare(`SELECT variant, key, bytes FROM variants WHERE tbl = ? AND row_id = ?`)
  const mark_verified = db.prepare(`UPDATE dicts SET verified_at = ? WHERE dict_id = ?`)
  const PHOTO_TABLES = new Set(['photos', 'partner_logos', 'featured_image'])

  let clean = 0
  let dirty = 0
  for (const { dict_id } of dicts) {
    const remote = new Map([
      ...await list_prefix(client, `${dict_id}/audio/`),
      ...await list_prefix(client, `${dict_id}/video/`),
      ...await list_prefix(client, `${dict_id}/photo/`),
    ])
    const problems: string[] = []
    let pending = 0
    for (const row of get_rows.all(dict_id) as { tbl: string, row_id: string, new_key: string, bytes: number, status: string }[]) {
      if (row.status === 'missing' || row.status === 'rewritten')
        continue
      if (row.status !== 'copied') {
        pending++
        continue
      }
      const size = remote.get(row.new_key)
      if (size === undefined)
        problems.push(`ABSENT ${row.new_key}`)
      else if (size !== row.bytes)
        problems.push(`SIZE ${row.new_key}: r2=${size} state=${row.bytes}`)
      if (PHOTO_TABLES.has(row.tbl)) {
        const variants = get_variants.all(row.tbl, row.row_id) as { variant: string, key: string, bytes: number }[]
        if (variants.length !== 3)
          problems.push(`VARIANTS ${row.new_key}: only ${variants.length}/3 recorded`)
        for (const variant of variants) {
          const variant_size = remote.get(variant.key)
          if (variant_size === undefined)
            problems.push(`ABSENT ${variant.key}`)
          else if (variant_size !== variant.bytes)
            problems.push(`SIZE ${variant.key}: r2=${variant_size} state=${variant.bytes}`)
        }
      }
    }
    if (problems.length || pending) {
      dirty++
      console.log(`✗ ${dict_id}: ${pending} uncopied, ${problems.length} mismatches`)
      for (const problem of problems.slice(0, 5))
        console.log(`    ${problem}`)
    } else {
      mark_verified.run(iso_now(), dict_id)
      clean++
    }
  }
  console.log(`DONE: ${clean} dicts verified clean, ${dirty} dicts with problems.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
