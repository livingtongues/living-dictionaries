import { get_shared_db } from './shared-db'

/**
 * Media storage ledger (server-only shared.db `media_objects`): one row per R2
 * media-bucket object, so /admin/storage never has to list R2. `+=` at upload
 * time from every write path; trued-up (sizes, abandoned presigns, deletions)
 * by the weekly media sweep. See the 20260723a migration header.
 */

export type MediaLedgerType = 'audio' | 'video' | 'photo'

export function record_media_object({ key, dict_id, media_type, bytes, is_variant = false }: {
  key: string
  dict_id: string
  media_type: MediaLedgerType
  bytes: number
  is_variant?: boolean
}): void {
  const db = get_shared_db()
  db.prepare(`
    INSERT INTO media_objects (key, dict_id, media_type, is_variant, bytes, uploaded_at)
    VALUES (@key, @dict_id, @media_type, @is_variant, @bytes, @uploaded_at)
    ON CONFLICT (key) DO UPDATE SET bytes = excluded.bytes, orphaned_at = NULL
  `).run({ key, dict_id, media_type, is_variant: is_variant ? 1 : 0, bytes, uploaded_at: new Date().toISOString() })
}

/** Ledger-record a stored object straight from its R2 key (no-op for unparseable keys). */
export function record_media_object_by_key({ key, bytes }: { key: string, bytes: number }): void {
  const parsed = parse_media_key(key)
  if (!parsed)
    return
  record_media_object({ key, bytes, ...parsed })
}

/** Parse `{dict}/{audio|video|photo}/{uuid}[_variant].{ext}` — null for foreign/legacy keys. */
export function parse_media_key(key: string): { dict_id: string, media_type: MediaLedgerType, is_variant: boolean } | null {
  const match = key.match(/^([^/]+)\/(audio|video|photo)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(_(?:thumb|w900|w1600))?\.[\w-]{1,10}$/)
  if (!match)
    return null
  return { dict_id: match[1], media_type: match[2] as MediaLedgerType, is_variant: !!match[3] }
}

if (import.meta.vitest) {
  const uuid = '48af49b0-b410-4db1-babf-38ac53269e62'
  test(parse_media_key, () => {
    expect(parse_media_key(`gta/audio/${uuid}.mp3`)).toEqual({ dict_id: 'gta', media_type: 'audio', is_variant: false })
    expect(parse_media_key(`gta/photo/${uuid}_thumb.webp`)).toEqual({ dict_id: 'gta', media_type: 'photo', is_variant: true })
    expect(parse_media_key(`gta/photo/${uuid}_w1600.webp`)).toEqual({ dict_id: 'gta', media_type: 'photo', is_variant: true })
    expect(parse_media_key('gta/images/old_123.jpg')).toBe(null)
    expect(parse_media_key(`gta/photo/${uuid}_w123.webp`)).toBe(null)
  })
}
