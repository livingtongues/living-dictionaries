import type { PoolClient } from 'pg'
import type { Row } from './mappers'

/**
 * Postgres read helpers for the old-site Supabase. All reads are scoped to the
 * service-role PG pool from `config-supabase.ts`. Content tables are read per
 * dictionary; shared tables (users, dictionaries, roles…) are read globally.
 */

export async function query<T = Row>(client: PoolClient, sql: string, params: any[] = []): Promise<T[]> {
  const result = await client.query(sql, params)
  return result.rows as T[]
}

/** Content tables migrated per-dictionary into `dictionaries/{id}.db`. */
export const DICT_CONTENT_TABLES = [
  'entries',
  'texts',
  'sentences',
  'senses',
  'senses_in_sentences',
  'speakers',
  'audio',
  'audio_speakers',
  'videos',
  'video_speakers',
  'sense_videos',
  'sentence_videos',
  'photos',
  'sense_photos',
  'sentence_photos',
  'dialects',
  'entry_dialects',
  'tags',
  'entry_tags',
] as const

export type DictContentTable = typeof DICT_CONTENT_TABLES[number]

const DICT_TABLE_SET = new Set<string>(DICT_CONTENT_TABLES)

/**
 * Read all rows of a content table for one dictionary via a server-side CURSOR,
 * fetching in bounded batches. A single big `SELECT` degrades super-linearly
 * through Supabase's transaction pooler (measured: 1k→3s, 5k→13s, 20k→130s);
 * batched FETCH keeps each round-trip small + linear and bounds pooler memory.
 * Works for every table including junctions (no `id`/keyset column needed).
 * Table name is allowlisted (it's interpolated, not a bind param).
 */
export async function read_dict_table(client: PoolClient, table: string, dict_id: string, { batch = 2000 }: { batch?: number } = {}): Promise<Row[]> {
  if (!DICT_TABLE_SET.has(table))
    throw new Error(`Refusing to read non-allowlisted table: ${table}`)

  const all: Row[] = []
  await client.query('BEGIN')
  try {
    await client.query(`DECLARE mig_cur NO SCROLL CURSOR FOR SELECT * FROM ${table} WHERE dictionary_id = $1`, [dict_id])
    while (true) {
      const rows = await query(client, `FETCH ${batch} FROM mig_cur`)
      all.push(...rows)
      if (rows.length < batch)
        break
    }
    await client.query('CLOSE mig_cur')
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  }
  return all
}

export async function count_entries(client: PoolClient, dict_id: string): Promise<number> {
  const [row] = await query<{ count: string }>(client, `SELECT COUNT(*)::int AS count FROM entries WHERE dictionary_id = $1 AND deleted IS NULL`, [dict_id])
  return Number(row?.count ?? 0)
}

/** All non-deleted entry counts in one query → `Map<dict_id, count>` (full-catalog mode). */
export async function read_all_entry_counts(client: PoolClient): Promise<Map<string, number>> {
  const rows = await query<{ dictionary_id: string, count: number }>(client, `SELECT dictionary_id, COUNT(*)::int AS count FROM entries WHERE deleted IS NULL GROUP BY dictionary_id`)
  return new Map(rows.map(row => [row.dictionary_id, Number(row.count)]))
}

export async function count_dict_table(client: PoolClient, table: string, dict_id: string): Promise<number> {
  if (!DICT_TABLE_SET.has(table))
    throw new Error(`Refusing to count non-allowlisted table: ${table}`)
  const [row] = await query<{ count: string }>(client, `SELECT COUNT(*)::int AS count FROM ${table} WHERE dictionary_id = $1`, [dict_id])
  return Number(row?.count ?? 0)
}

// --- shared.db sources -----------------------------------------------------

export function read_dictionaries(client: PoolClient, { dict_id, limit }: { dict_id?: string, limit?: number }): Promise<Row[]> {
  if (dict_id)
    return query(client, `SELECT * FROM dictionaries WHERE id = $1`, [dict_id])
  if (limit)
    return query(client, `SELECT * FROM dictionaries ORDER BY id LIMIT $1`, [limit])
  return query(client, `SELECT * FROM dictionaries ORDER BY id`)
}

export const read_dictionary_info = (client: PoolClient) => query(client, `SELECT * FROM dictionary_info`)
export const read_dictionary_roles = (client: PoolClient) => query(client, `SELECT * FROM dictionary_roles`)
export const read_dictionary_partners = (client: PoolClient) => query(client, `SELECT * FROM dictionary_partners`)
export const read_invites = (client: PoolClient) => query(client, `SELECT * FROM invites`)

/** Fetch only the specific photos referenced by partner logos (not the whole table). */
export function read_photos_by_ids(client: PoolClient, ids: string[]): Promise<Row[]> {
  if (ids.length === 0)
    return Promise.resolve([])
  return query(client, `SELECT id, storage_path, serving_url FROM photos WHERE id = ANY($1)`, [ids])
}

export const read_auth_users = (client: PoolClient) => query(client, `SELECT id, email, created_at, updated_at, raw_user_meta_data FROM auth.users`)
export const read_profiles = (client: PoolClient) => query(client, `SELECT id, email, full_name, avatar_url FROM profiles_view`)
export const read_user_data = (client: PoolClient) => query(client, `SELECT * FROM user_data`)

/**
 * Build `{ user_id -> [{provider, provider_id}] }` from auth.identities.
 * `identity_data.sub` is the stable provider subject (Google sub, etc.);
 * for the email provider it's the verified email.
 */
export async function read_identities_by_user(client: PoolClient): Promise<Map<string, { provider: string, provider_id: string }[]>> {
  const identities = await query<{ user_id: string, provider: string, identity_data: any }>(
    client,
    `SELECT user_id, provider, identity_data FROM auth.identities`,
  )
  const map = new Map<string, { provider: string, provider_id: string }[]>()
  for (const identity of identities) {
    const provider_id = identity.identity_data?.sub ?? identity.identity_data?.email ?? identity.user_id
    const list = map.get(identity.user_id) ?? []
    list.push({ provider: identity.provider, provider_id: String(provider_id) })
    map.set(identity.user_id, list)
  }
  return map
}
