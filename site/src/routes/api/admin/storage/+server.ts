/**
 * /admin/storage data: aggregates of the server-only `media_objects` ledger +
 * `media_storage_daily` rollups (never lists R2 — the weekly sweep keeps the
 * ledger true). Category = the dict's CURRENT `dictionaries.bucket` (mutable —
 * history re-attributes on re-triage, by design).
 */
import type { RequestHandler } from './$types'
import { is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

export interface StorageDictRow {
  dict_id: string
  name: string | null
  bucket: string | null
  audio_bytes: number
  video_bytes: number
  photo_bytes: number
  total_bytes: number
  object_count: number
}

export interface StorageTrendPoint {
  date: string
  media_type: string
  bytes: number
}

export interface AdminStorageResponseBody {
  generated_at: string
  last_reconcile: string | null
  totals: { media_type: string, bytes: number, object_count: number }[]
  orphaned: { bytes: number, object_count: number }
  dicts: StorageDictRow[]
  trend: StorageTrendPoint[]
}

export const GET: RequestHandler = async (event) => {
  const auth = await verify_auth(event)
  if (!is_admin(auth.email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const db = get_shared_db()

  const totals = db.prepare(`
    SELECT media_type, SUM(bytes) AS bytes, COUNT(*) AS object_count
    FROM media_objects GROUP BY media_type ORDER BY bytes DESC
  `).all() as AdminStorageResponseBody['totals']

  const orphaned = db.prepare(`
    SELECT COALESCE(SUM(bytes), 0) AS bytes, COUNT(*) AS object_count
    FROM media_objects WHERE orphaned_at IS NOT NULL
  `).get() as AdminStorageResponseBody['orphaned']

  const dicts = db.prepare(`
    SELECT m.dict_id, d.name, d.bucket,
      SUM(CASE WHEN m.media_type = 'audio' THEN m.bytes ELSE 0 END) AS audio_bytes,
      SUM(CASE WHEN m.media_type = 'video' THEN m.bytes ELSE 0 END) AS video_bytes,
      SUM(CASE WHEN m.media_type = 'photo' THEN m.bytes ELSE 0 END) AS photo_bytes,
      SUM(m.bytes) AS total_bytes,
      COUNT(*) AS object_count
    FROM media_objects m
    LEFT JOIN dictionaries d ON d.id = m.dict_id
    GROUP BY m.dict_id
    ORDER BY total_bytes DESC
  `).all() as StorageDictRow[]

  const trend = db.prepare(`
    SELECT date, media_type, SUM(bytes) AS bytes
    FROM media_storage_daily GROUP BY date, media_type ORDER BY date
  `).all() as StorageTrendPoint[]

  const last_reconcile = (db.prepare(`SELECT value FROM db_metadata WHERE key = 'media_sweep_last_reconcile'`)
    .get() as { value: string } | undefined)?.value ?? null

  return json({
    generated_at: new Date().toISOString(),
    last_reconcile,
    totals,
    orphaned,
    dicts,
    trend,
  } satisfies AdminStorageResponseBody)
}
