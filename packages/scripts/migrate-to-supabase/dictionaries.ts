import fs, { writeFileSync } from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { access } from 'node:fs/promises'
import { db } from '../config-firebase'
import { postgres } from '../config-supabase'
import { sync_users_across_and_write_fb_sb_mappings, write_users_to_disk } from './users'
import { generate_dictionary_inserts } from './generate-dictionary-inserts'
import { load_fb_to_sb_user_ids } from './get-user-id'
import type { IDictionary } from './types'

migrate_dictionaries()

const FOLDER = 'firestore-data'
const dictionaries_filename = 'firestore-dictionaries-prod.json'

const __dirname = dirname(fileURLToPath(import.meta.url))
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

async function migrate_dictionaries() {
  // await reset_local_db()
  await write_users_to_disk()
  await sync_users_across_and_write_fb_sb_mappings() // needs run twice, first to sync users, then to load them into memory
  await sync_users_across_and_write_fb_sb_mappings() // needs run twice, first to sync users, then to load them into memory

  const dictionaries = await get_dictionaries()
  await load_fb_to_sb_user_ids()

  let sql_query = 'BEGIN;' // Start a transaction

  const dictionary_sql = generate_dictionary_inserts(dictionaries)
  sql_query += `${dictionary_sql}\n`
  sql_query += '\nCOMMIT;' // End the transaction
  try {
    writeFileSync(`./logs/${Date.now()}_dictionaries-query.sql`, sql_query)
    console.log('executing sql query')
    await postgres.execute_query(sql_query)
    console.log('finished')
  } catch (err) {
    console.error(err)
    await postgres.execute_query('ROLLBACK;') // Rollback the transaction in case of error
  }
}

async function get_dictionaries() {
  // const dictionaries_downloaded = await file_exists(dictionaries_filename)

  // if (dictionaries_downloaded) {
  //   const firebase_dictionaries = (await import('./firestore-data/firestore-dictionaries-prod.json')).default as IDictionary[]
  //   return firebase_dictionaries
  // }

  const fb_dictionaries: IDictionary[] = []

  const dict_snapshot = await db.collection('dictionaries').get()

  for (const dictionary of dict_snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IDictionary))) {
    console.info(dictionary.id)
    fb_dictionaries.push(dictionary)
  }

  console.log(`Done fetching ${fb_dictionaries.length} dictionaries`)

  fs.writeFileSync(path.resolve(__dirname, FOLDER, dictionaries_filename), JSON.stringify(fb_dictionaries, null, 2))

  return fb_dictionaries
}
