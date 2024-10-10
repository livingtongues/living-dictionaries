import fs, { readFileSync } from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GoogleAuthUserMetaData, ISpeaker, IUser } from '@living-dictionaries/types'
import Chain from 'stream-chain'
import Parser from 'stream-json'
import StreamArray from 'stream-json/streamers/StreamArray'
import { admin_supabase, execute_query } from '../config-supabase'
import firebase_speakers from './firestore-data/firestore-speakers.json'
import type { AllSpeakerData } from './migrate-entries'
import { migrate_entry, migrate_speakers } from './migrate-entries'
import { remove_seconds_underscore } from './utils/remove-seconds-underscore'

const FOLDER = 'firestore-data'

// pnpm -F scripts run-migration
run_migration_part_2()

async function run_migration_part_1() {
  await seed_local_db_with_production_data() // only on local test runs
  await write_fb_sb_mappings()
}

// separate because migrate_speakers imports a file that the first part hasn't yet written
async function run_migration_part_2() {
  const speakers = await migrate_speakers(firebase_speakers as ISpeaker[])
  // await migrate_entries(entries_to_test, speakers)
  await migrate_all_entries(speakers)
}

async function migrate_all_entries(speakers: AllSpeakerData) {
  const dictionary_dialects: Record<string, Record<string, string>> = {}
  const dictionary_new_speakers: Record<string, Record<string, string>> = {}

  const pipeline = Chain.chain([
    fs.createReadStream('./migrate-to-supabase/firestore-data/firestore-entries.json'),
    Parser.parser(),
    StreamArray.streamArray(),
  ])

  const start_index = 148000
  // const end_index = start_index + batch_size
  let index = 0
  let current_entry_id = ''
  try {
    for await (const { value: fb_entry } of pipeline) {
      // if (index >= start_index && index < end_index) {
      if (index >= start_index) {
        current_entry_id = `${fb_entry.dictionary_id}/${fb_entry.id}`
        const seconds_corrected_entry = remove_seconds_underscore(fb_entry)
        await migrate_entry(seconds_corrected_entry, speakers, dictionary_dialects, dictionary_new_speakers)
        if (index % 500 === 0)
          console.log(`import reached ${index}`)
      }
      index++
    }
    console.log('finished')
  } catch (err) {
    console.log(`error at index ${index}: _ROOT_/${current_entry_id}, ${err}`)
    console.error(err)
    pipeline.destroy()
    pipeline.input.destroy()
  }
}

async function seed_local_db_with_production_data() {
  const seedFilePath = '../../supabase/seeds/from-backup.sql'
  const seed_sql = readFileSync(seedFilePath, 'utf8')
  await execute_query(seed_sql)
}

async function write_fb_sb_mappings() {
  const firebase_uid_to_supabase_user_id: Record<string, string> = {}
  const { data: sb_users } = await admin_supabase.from('user_emails')
    .select('id, email')
    .limit(2000)

  const supabase_users_not_in_firebase = new Set(sb_users.map(sb_user => sb_user.email))
  const unmatched_firebase = []

  const firebase_users = (await import('./firestore-data/firestore-users.json')).default

  for (const fb_user of firebase_users) {
    const matching_sb_user = sb_users.find(sb_user => sb_user.email === fb_user.email)

    if (matching_sb_user) {
      firebase_uid_to_supabase_user_id[fb_user.uid] = matching_sb_user.id
      supabase_users_not_in_firebase.delete(matching_sb_user.email)
    } else {
      const new_sb_user_id = await save_user_to_supabase(fb_user as IUser)
      firebase_uid_to_supabase_user_id[fb_user.uid] = new_sb_user_id
    }
  }

  console.log({ unmatched_firebase: unmatched_firebase.length, sb_users: sb_users.length, firebase_users: firebase_users.length, supabase_users_not_in_firebase: supabase_users_not_in_firebase.size })

  const __dirname = dirname(fileURLToPath(import.meta.url))
  fs.writeFileSync(path.resolve(__dirname, FOLDER, 'fb-sb-user-ids.json'), JSON.stringify(firebase_uid_to_supabase_user_id, null, 2))
}

async function save_user_to_supabase(user: IUser): Promise<string> {
  const { data, error } = await admin_supabase.auth.admin.createUser({
    email: user.email,
    email_confirm: true,
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
