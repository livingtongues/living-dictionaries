import fs, { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { access } from 'node:fs/promises'
import type { GoogleAuthUserMetaData, IUser } from '@living-dictionaries/types'
import Chain from 'stream-chain'
import Parser from 'stream-json'
import StreamArray from 'stream-json/streamers/StreamArray'
import type { UserRecord } from 'firebase-admin/auth'
import { admin_supabase, postgres } from '../config-supabase'
import type { AllSpeakerData } from './migrate-entries'
import { load_speakers, migrate_entry } from './migrate-entries'
import { remove_seconds_underscore } from './utils/remove-seconds-underscore'
import { load_fb_to_sb_user_ids } from './get-user-id'
import { write_users_insert } from './write-users-insert'

const FOLDER = 'firestore-data'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function local_filepath(filename: string): string {
  return path.join(__dirname, FOLDER, filename)
}

async function file_exists(filename: string): Promise<boolean> {
  try {
    await access(local_filepath(filename), fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

// 0
// 20000
const next_starting_point = 241297
// 60000
// 80000
// 100000
// 120000
// 140000
// 160000
// 180000
// 200000
// 220000
// 240000
// 260000
// 280000
// 300000
// 320000
// 340000
// 360000
// 380000
const already_done = 2233
run_migration({ start_index: already_done + next_starting_point, batch_size: 150000 })

async function run_migration({ start_index, batch_size }: { start_index: number, batch_size: number }) {
  console.log({ start_index, batch_size })

  // if (next_starting_point === 0)
  //   await seed_local_db_with_production_data()

  // const entries_downloaded = await file_exists('firestore-entries.json')
  // if (!entries_downloaded)
  //   await write_entries()
  // const speakers_downloaded = await file_exists('firestore-speakers.json')
  // if (!speakers_downloaded)
  //   await write_speakers()
  // const users_downloaded = await file_exists('firestore-users.json')
  // if (!users_downloaded)
  //   await write_users()

  // if (start_index === 0) {
  //   await write_fb_sb_mappings() // user mappings
  // }

  await load_fb_to_sb_user_ids()

  // if (start_index === 0) {
  //   await migrate_speakers() // speaker mappings
  // }

  const fb_to_sb_speakers = await load_speakers()
  await migrate_all_entries({ fb_to_sb_speakers, start_index, batch_size })
}

async function migrate_all_entries({ fb_to_sb_speakers, start_index, batch_size }: { fb_to_sb_speakers: AllSpeakerData, start_index: number, batch_size: number }) {
  const { data: dialects } = await admin_supabase.from('dialects').select('id, name, dictionary_id')
  const dictionary_dialects: Record<string, Record<string, string>> = dialects.reduce((acc: Record<string, Record<string, string>>, { id, name, dictionary_id }) => {
    if (!acc[dictionary_id]) {
      acc[dictionary_id] = {}
    }
    acc[dictionary_id][name.default] = id
    return acc
  }, {})

  const { data: speakers_added_to_sb_by_name } = await admin_supabase.from('speakers').select('id, name, dictionary_id')
  const dictionary_new_speakers: Record<string, Record<string, string>> = speakers_added_to_sb_by_name.reduce((acc: Record<string, Record<string, string>>, { id, name, dictionary_id }) => {
    if (!acc[dictionary_id]) {
      acc[dictionary_id] = {}
    }
    acc[dictionary_id][name] = id
    return acc
  }, {})

  const pipeline = Chain.chain([
    fs.createReadStream('./migrate-to-supabase/firestore-data/firestore-entries.json'),
    Parser.parser(),
    StreamArray.streamArray(),
  ])

  const end_index = start_index + batch_size
  let index = 0
  let current_dictionary_entry_id = ''
  let sql_query = 'BEGIN;' // Start a transaction

  try {
    for await (const { value: fb_entry } of pipeline) {
      if (index >= start_index && index < end_index) {
        current_dictionary_entry_id = `${fb_entry.dictionary_id}/${fb_entry.id}`
        const seconds_corrected_entry = remove_seconds_underscore(fb_entry)
        console.info(index)
        const sql_statements = migrate_entry(seconds_corrected_entry, fb_to_sb_speakers, dictionary_dialects, dictionary_new_speakers)
        sql_query += `${sql_statements}\n`

        if (index % 500 === 0)
          console.log(`import reached ${index}`)
      }
      index++
    }
  } catch (err) {
    console.log(`error at index ${index}: _ROOT_/${current_dictionary_entry_id}, ${err}`)
    console.error(err)
  } finally {
    pipeline.destroy()
    pipeline.input.destroy()
  }

  sql_query += '\nCOMMIT;' // End the transaction

  try {
    writeFileSync(`./logs/${start_index}-${start_index + batch_size}-query.sql`, sql_query)
    console.log('executing sql query')
    await postgres.execute_query(sql_query)
    console.log('finished')
  } catch (err) {
    console.error(err)
    await postgres.execute_query('ROLLBACK;') // Rollback the transaction in case of error
  }
}

async function seed_local_db_with_production_data() {
  console.log('Seeding local db with production data')
  await postgres.execute_query(`truncate table auth.users cascade;`)
  await postgres.execute_query('truncate table entry_updates cascade;')
  await postgres.execute_query(readFileSync('../../supabase/seeds/backup-after-2232-imported.sql', 'utf8'))
}

async function write_fb_sb_mappings() {
  console.log('writing user mappings')
  const firebase_uid_to_supabase_user_id: Record<string, string> = {}
  const { data: sb_users_1 } = await admin_supabase.from('user_emails')
    .select('id, email')
    .order('id', { ascending: true })
    .range(0, 999)
  const { data: sb_users_2 } = await admin_supabase.from('user_emails')
    .select('id, email')
    .order('id', { ascending: true })
    .range(1000, 1999)

  const sb_users = [...sb_users_1, ...sb_users_2]

  const supabase_users_not_in_firebase = new Set(sb_users.map(sb_user => sb_user.email))
  const unmatched_firebase = []

  const firebase_users = (await import('./firestore-data/firestore-users.json')).default

  for (const fb_user of firebase_users) {
    const matching_sb_user = sb_users.find(sb_user => sb_user.email === fb_user.email)

    if (matching_sb_user) {
      firebase_uid_to_supabase_user_id[fb_user.uid] = matching_sb_user.id
      supabase_users_not_in_firebase.delete(matching_sb_user.email)
    } else {
      const sql = write_users_insert([fb_user as UserRecord])
      console.log(sql)
      // await execute_query(sql)

      // const new_sb_user_id = await save_user_to_supabase(fb_user as UserRecord)
      // firebase_uid_to_supabase_user_id[fb_user.uid] = new_sb_user_id
    }
  }

  console.log({ unmatched_firebase: unmatched_firebase.length, sb_users: sb_users.length, firebase_users: firebase_users.length, supabase_users_not_in_firebase: supabase_users_not_in_firebase.size })

  fs.writeFileSync(path.resolve(__dirname, FOLDER, 'fb-sb-user-ids.json'), JSON.stringify(firebase_uid_to_supabase_user_id, null, 2))
}

async function save_user_to_supabase(user: UserRecord): Promise<string> {
  const { data, error } = await admin_supabase.auth.admin.createUser({
    email: user.email,
    email_confirm: user.emailVerified,
    app_metadata: { fb_uid: user.uid },
    user_metadata: get_firebase_user_meta_data(user),
  })
  if (error)
    throw new Error(`Error creating user: ${user.email}`)
  console.info({ created: data.user.email })
  return data?.user?.id
}

function get_firebase_user_meta_data({ displayName, photoURL }: IUser) {
  const metadata: GoogleAuthUserMetaData = {}
  if (displayName)
    metadata.full_name = displayName
  if (photoURL)
    metadata.avatar_url = photoURL
  return metadata
}
