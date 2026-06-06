import type Database from 'better-sqlite3'
import type { PoolClient } from 'pg'
import type { Row } from './mappers'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { postgres } from '../config-supabase'
import { insert_rows, set_last_modified_to_max, upsert_rows } from './db-insert'
import {
  build_sentence_order,
  DICT_JSON_COLS,
  map_audio,
  map_dialect,
  map_dictionary,
  map_dictionary_partner,
  map_dictionary_role,
  map_entry,
  map_invite,
  map_junction,
  map_photo,
  map_sense,
  map_sentence,
  map_speaker,
  map_tag,
  map_text,
  map_user,
  map_video,
  SHARED_JSON_COLS,
} from './mappers'
import { LATEST_DICT_MIGRATION, open_dict_db, open_shared_db } from './open-sqlite'
import * as read from './read'

const here = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DATA_DIR = resolve(here, '../../../site/.data')

function get_flag(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--'))
    return process.argv[index + 1]
  return fallback
}
const has_flag = (name: string) => process.argv.includes(name)

/** Per-content-table mapper config. Junction tables get a synthetic UUID PK. */
const CONTENT_CONFIG: Record<string, { map?: (row: Row) => Row, json?: string[], junction?: string[] }> = {
  entries: { map: map_entry, json: DICT_JSON_COLS.entries },
  texts: { map: map_text, json: DICT_JSON_COLS.texts },
  sentences: { map: map_sentence, json: DICT_JSON_COLS.sentences },
  senses: { map: map_sense, json: DICT_JSON_COLS.senses },
  senses_in_sentences: { junction: ['sense_id', 'sentence_id'] },
  speakers: { map: map_speaker },
  audio: { map: map_audio },
  audio_speakers: { junction: ['audio_id', 'speaker_id'] },
  videos: { map: map_video, json: DICT_JSON_COLS.videos },
  video_speakers: { junction: ['video_id', 'speaker_id'] },
  sense_videos: { junction: ['sense_id', 'video_id'] },
  sentence_videos: { junction: ['sentence_id', 'video_id'] },
  photos: { map: map_photo },
  sense_photos: { junction: ['sense_id', 'photo_id'] },
  sentence_photos: { junction: ['sentence_id', 'photo_id'] },
  dialects: { map: map_dialect, json: DICT_JSON_COLS.dialects },
  entry_dialects: { junction: ['entry_id', 'dialect_id'] },
  tags: { map: map_tag },
  entry_tags: { junction: ['entry_id', 'tag_id'] },
}

async function migrate_users({ client, shared }: { client: PoolClient, shared: Database.Database }): Promise<Set<string>> {
  const [auth_users, profiles, user_data, identities] = await Promise.all([
    read.read_auth_users(client),
    read.read_profiles(client),
    read.read_user_data(client),
    read.read_identities_by_user(client),
  ])
  const profile_by_id = new Map(profiles.map(profile => [profile.id, profile]))
  const user_data_by_id = new Map(user_data.map(data => [data.id, data]))

  const rows = auth_users.map(auth_user => map_user({
    auth_user,
    profile: profile_by_id.get(auth_user.id),
    user_data: user_data_by_id.get(auth_user.id),
    providers: identities.get(auth_user.id) ?? [],
  }))
  upsert_rows({ db: shared, table: 'users', rows, json_cols: SHARED_JSON_COLS.users })
  console.info(`  users: ${rows.length}`)
  return new Set(rows.map(row => row.id))
}

async function migrate_catalog({ client, shared, dicts, valid_user_ids }: {
  client: PoolClient
  shared: Database.Database
  dicts: Row[]
  valid_user_ids: Set<string>
}) {
  const dict_ids = new Set(dicts.map(dict => dict.id))
  const info_by_id = new Map((await read.read_dictionary_info(client)).map(info => [info.id, info]))
  const entry_counts = await read.read_all_entry_counts(client)
  const nullify_missing = (user_id: any) => (user_id && valid_user_ids.has(user_id) ? user_id : null)

  // dictionaries
  const dict_rows: Row[] = []
  for (const dict of dicts) {
    const row = map_dictionary({ dict, info: info_by_id.get(dict.id), entry_count: entry_counts.get(dict.id) ?? 0 })
    row.created_by_user_id = nullify_missing(row.created_by_user_id)
    row.updated_by_user_id = nullify_missing(row.updated_by_user_id)
    // Mark schema-current so the server's startup migration sweep
    // (hooks.server.ts) doesn't synchronously create empty dict.dbs for every
    // catalog row. Dicts whose content we migrate get this re-confirmed; dicts
    // with no content yet are created lazily by `get_dictionary_db` on access.
    row.dict_db_schema_version = LATEST_DICT_MIGRATION
    dict_rows.push(row)
  }
  upsert_rows({ db: shared, table: 'dictionaries', rows: dict_rows, json_cols: SHARED_JSON_COLS.dictionaries })
  console.info(`  dictionaries: ${dict_rows.length}`)

  // roles — delete-then-insert scoped to migrated dicts (synthetic UUID PK)
  const roles = (await read.read_dictionary_roles(client))
    .filter(role => dict_ids.has(role.dictionary_id) && valid_user_ids.has(role.user_id))
    .map((role) => {
      const row = map_dictionary_role(role)
      row.invited_by_user_id = nullify_missing(row.invited_by_user_id)
      return row
    })
  delete_for_dicts({ db: shared, table: 'dictionary_roles', dict_ids })
  insert_rows({ db: shared, table: 'dictionary_roles', rows: roles })
  console.info(`  dictionary_roles: ${roles.length}`)

  // partners — denormalize the logo, fetching only the referenced photos
  const all_partners = (await read.read_dictionary_partners(client)).filter(partner => dict_ids.has(partner.dictionary_id))
  const partner_photo_ids = all_partners.map(partner => partner.photo_id).filter(Boolean) as string[]
  const photos_by_id = new Map((await read.read_photos_by_ids(client, partner_photo_ids)).map(photo => [photo.id, photo]))
  const partners = all_partners
    .map(partner => map_dictionary_partner({ partner, photo: partner.photo_id ? photos_by_id.get(partner.photo_id) : undefined }))
  delete_for_dicts({ db: shared, table: 'dictionary_partners', dict_ids })
  insert_rows({ db: shared, table: 'dictionary_partners', rows: partners })
  console.info(`  dictionary_partners: ${partners.length}`)

  // invites — upsert by id
  const invites = (await read.read_invites(client))
    .filter(invite => dict_ids.has(invite.dictionary_id) && valid_user_ids.has(invite.created_by))
    .map(map_invite)
  upsert_rows({ db: shared, table: 'invites', rows: invites })
  console.info(`  invites: ${invites.length}`)
}

function delete_for_dicts({ db, table, dict_ids }: { db: Database.Database, table: string, dict_ids: Set<string> }) {
  if (dict_ids.size === 0)
    return
  const placeholders = Array.from(dict_ids).map(() => '?').join(', ')
  db.prepare(`DELETE FROM ${table} WHERE dictionary_id IN (${placeholders})`).run(...dict_ids)
}

async function migrate_dict_content({ client, data_dir, dict, shared }: {
  client: PoolClient
  data_dir: string
  dict: Row
  shared: Database.Database
}) {
  const db = open_dict_db({ data_dir, dict_id: dict.id, rebuild: true })
  db.pragma('foreign_keys = OFF') // source data is already FK-valid; speeds bulk insert + dodges orphan-ordering issues
  const counts: Record<string, number> = {}
  // texts (read before sentences) yields per-sentence order derived from the
  // legacy id-array; applied to sentence rows as sort_key + ends_paragraph.
  let sentence_order = new Map<string, { sort_key: string, ends_paragraph: number | null }>()
  try {
    for (const table of read.DICT_CONTENT_TABLES) {
      const config = CONTENT_CONFIG[table]
      const source_rows = await read.read_dict_table(client, table, dict.id)
      if (table === 'texts')
        sentence_order = build_sentence_order(source_rows)
      const rows = config.junction
        ? source_rows.map(row => map_junction(row, config.junction!))
        : source_rows.map(row => config.map!(row))
      if (table === 'sentences') {
        for (const row of rows) {
          const order = sentence_order.get(row.id)
          if (order) {
            row.sort_key = order.sort_key
            row.ends_paragraph = order.ends_paragraph
          }
        }
      }
      counts[table] = insert_rows({ db, table, rows, json_cols: config.json })
    }
    set_last_modified_to_max({ db, tables: [...read.DICT_CONTENT_TABLES] })
  } finally {
    db.pragma('foreign_keys = ON')
    const violations = db.pragma('foreign_key_check') as unknown[]
    if (violations.length)
      console.warn(`  ⚠️ ${dict.id}: ${violations.length} FK violations (orphan refs in source)`)
    db.close()
  }

  shared.prepare(`UPDATE dictionaries SET dict_db_schema_version = ?, entry_count = ? WHERE id = ?`)
    .run(LATEST_DICT_MIGRATION, counts.entries ?? 0, dict.id)

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  console.info(`  ✓ ${dict.id}: ${counts.entries ?? 0} entries, ${total} content rows`)
}

async function main() {
  const data_dir = get_flag('--data-dir', DEFAULT_DATA_DIR)!
  const dict_id = get_flag('--dict-id')
  const limit_raw = get_flag('--limit')
  const limit = limit_raw ? Number(limit_raw) : undefined
  const dry = has_flag('--dry')
  // Full catalog for ALL dicts, content only for this subset (comma-separated ids).
  const content_dicts_raw = get_flag('--content-dicts')
  const content_subset = content_dicts_raw ? new Set(content_dicts_raw.split(',').map(id => id.trim())) : null

  const client = await postgres.get_db_connection()
  const started = Date.now()
  try {
    // Catalog scope: all dicts when --content-dicts is set, else the filtered scope.
    const catalog_dicts = content_subset
      ? await read.read_dictionaries(client, {})
      : await read.read_dictionaries(client, { dict_id, limit })
    const content_dicts = content_subset
      ? catalog_dicts.filter(dict => content_subset.has(dict.id))
      : catalog_dicts

    console.info(`\nMigrating Supabase → SQLite`)
    console.info(`  data_dir: ${data_dir}`)
    console.info(`  catalog: ${catalog_dicts.length} dicts · content: ${content_dicts.length} dicts${dry ? ' (dry run)' : ''}\n`)

    if (dry) {
      console.info(`Would migrate content for ${content_dicts.length} dictionaries:`)
      for (const dict of content_dicts) {
        const entry_count = await read.count_entries(client, dict.id)
        console.info(`  ${dict.id} — "${dict.name}" — ${entry_count} entries`)
      }
      return
    }

    const shared = open_shared_db(data_dir)
    console.info('shared.db:')
    const valid_user_ids = await migrate_users({ client, shared })
    await migrate_catalog({ client, shared, dicts: catalog_dicts, valid_user_ids })

    console.info(`\ndictionaries/ (${content_dicts.length} files):`)
    for (const dict of content_dicts)
      await migrate_dict_content({ client, data_dir, dict, shared })

    shared.close()
    console.info(`\n✓ Done in ${((Date.now() - started) / 1000).toFixed(1)}s`)
  } finally {
    client.release()
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error)
  process.exit(1)
})
