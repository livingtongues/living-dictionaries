import fs, { writeFileSync } from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { access } from 'node:fs/promises'
import type { IDictionary, TablesInsert } from '@living-dictionaries/types'
import { reset_local_db } from '../reset-local-db'
import { db } from '../config-firebase'
import { jacob_ld_user_id, postgres } from '../config-supabase'
import { sql_file_string } from '../import/to-sql-string'
import { get_supabase_user_id_from_firebase_uid, load_fb_to_sb_user_ids } from './get-user-id'
import { write_users } from './users'

migrate_dictionaries()

const FOLDER = 'firestore-data'
const dictionaries_filename = 'firestore-dictionaries.json'
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
  await reset_local_db()
  await write_users()
  write_fb_sb_mappings()

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
  const dictionaries_downloaded = await file_exists(dictionaries_filename)

  if (dictionaries_downloaded) {
    const firebase_dictionaries = (await import('./firestore-data/firestore-dictionaries.json')).default as IDictionary[]
    return firebase_dictionaries
  }

  const fb_dictionaries: IDictionary[] = []

  const dict_snapshot = await db.collection('dictionaries').get()

  for (const dictionary of dict_snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IDictionary))) {
    console.log(dictionary.id)
    fb_dictionaries.push(dictionary)
    // const allow = /^[a].*/
    // if (!allow.test(dictionary_id.toLowerCase())) continue
  }

  console.log(`Done fetching ${fb_dictionaries.length} dictionaries`)

  fs.writeFileSync(path.resolve(__dirname, FOLDER, dictionaries_filename), JSON.stringify(fb_dictionaries, null, 2))

  return fb_dictionaries
}

export function generate_dictionary_inserts(dictionaries: IDictionary[]): string {
  let sql_statements = ''

  for (const firebase_dictionary of dictionaries) {
    const { id, name, alternateNames, glossLanguages, location, iso6393, glottocode, coordinates, points, regions, public: is_public, printAccess, copyright, alternateOrthographies, languageUsedByCommunity, authorConnection, communityPermission, conLangDescription, featuredImage, hideLivingTonguesLogo, publishYear, population, thumbnail, url, type, createdAt, createdBy, updatedAt, updatedBy } = firebase_dictionary

    const created_by = get_supabase_user_id_from_firebase_uid(createdBy) || jacob_ld_user_id

    const dictionary: TablesInsert<'dictionaries'> = {
    } as TablesInsert<'dictionaries'>

    const _dictionary: TablesInsert<'dictionaries'> = {
      id,
      name,
      alternate_names: alternateNames,
      orthographies: alternateOrthographies ? alternateOrthographies.map(name => ({ bcp: '', name: { default: name } })) : null,
      author_connection: authorConnection,
      community_permission: communityPermission,
      con_language_description: conLangDescription,
      location,
      // TODO: test combine coordinates  with points
      coordinates: {
        points: [{ coordinates }, ...points],
        regions,
      },
      copyright,
      featured_image: featuredImage,
      gloss_languages: glossLanguages,
      glottocode,
      hide_living_tongues_logo: hideLivingTonguesLogo,
      iso_639_3: iso6393,
      language_used_by_community: languageUsedByCommunity,
      metadata: { // TODO: don't add when not existing
        publishYear,
        population,
        thumbnail,
        url,
        type,
      },
      print_access: printAccess,
      public: is_public,
      created_at: seconds_to_timestamp_string(createdAt.seconds),
      created_by,
      updated_at: seconds_to_timestamp_string(updatedAt.seconds),
      updated_by: get_supabase_user_id_from_firebase_uid(updatedBy) || created_by,
      // TODO: confirm videoAccess deprecated
    }

    if (Object.keys(firebase_dictionary).length !== 0) {
      console.log({ firebase_dictionary })
      throw new Error('Entry not fully converted')
    }

    const sql = sql_file_string('dictionaries', dictionary, 'UPSERT')
    sql_statements += sql
  }

  return sql_statements
}

function seconds_to_timestamp_string(seconds: number): string {
  return new Date(seconds * 1000).toISOString()
}
function write_fb_sb_mappings() {
  throw new Error('Function not implemented.')
}
