import { writeFileSync } from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IHelper, IInvite } from '@living-dictionaries/types/invite.interface'
import type { Citation, IAbout, IGrammar, Partner } from '@living-dictionaries/types/dictionary.interface'
import { db } from '../config-firebase'
import { admin_supabase, postgres } from '../config-supabase'
import { load_fb_to_sb_user_ids } from './get-user-id'
import { generate_inserts } from './generate-inserts'

migrate_the_rest()

async function migrate_the_rest() {
  // if (environment === 'dev') {
  //   await reset_local_db()
  // }
  // if (environment === 'prod') {
  //   await save_dictionaries() // just do once
  // }
  // await write_users_to_disk() // just do once
  // await sync_users_across_and_write_fb_sb_mappings() // needs run twice, first to sync users, then to save them to disk
  // await sync_users_across_and_write_fb_sb_mappings() // needs run twice, first to sync users, then to save them to disk
  await load_fb_to_sb_user_ids()

  const dictionaries = await load_saved_dictionaries()

  const fb_managers = await get_managers_by_dictionary_id()
  const fb_contributors = await get_contributors_by_dictionary_id()
  const fb_writeInCollaborators = await get_writeInCollaborators_by_dictionary_id()
  const fb_invites = await get_invites_by_dictionary_id()
  const fb_partners = await get_partners_by_dictionary_id()
  const fb_dictionary_infos = await get_info_by_dictionary_id()

  let sql_query = 'BEGIN;' // Start a transaction
  // if (environment === 'dev') {
  //   for (const { id, name } of dictionaries) {
  //     const dictionary_sql = sql_file_string('dictionaries', { id, name, created_by: jacob_ld_user_id, updated_by: jacob_ld_user_id })
  //     sql_query += `${dictionary_sql}\n`
  //   }
  // }

  const sql = generate_inserts({
    dictionary_ids: dictionaries.map(({ id }) => id),
    fb_managers,
    fb_contributors,
    fb_writeInCollaborators,
    fb_dictionary_infos,
    fb_invites,
    fb_partners,
  })
  sql_query += `${sql}\n`
  sql_query += '\nCOMMIT;' // End the transaction
  try {
    writeFileSync(`./logs/${Date.now()}_migrate-the-rest-query.sql`, sql_query)
    console.log('executing sql query')
    await postgres.execute_query(sql_query)
    console.log('finished')
  } catch (err) {
    console.error(err)
    await postgres.execute_query('ROLLBACK;') // Rollback the transaction in case of error
  }
}

const FOLDER = 'firestore-data'
const __dirname = dirname(fileURLToPath(import.meta.url))

async function save_dictionaries() {
  const { data: dictionaries_1 } = await admin_supabase.from('dictionaries')
    .select('id, name')
    .order('id', { ascending: true })
    .range(0, 999)
  const { data: dictionaries_2 } = await admin_supabase.from('dictionaries')
    .select('id, name')
    .order('id', { ascending: true })
    .range(1000, 1999)

  writeFileSync(path.resolve(__dirname, FOLDER, 'dictionaries.json'), JSON.stringify([...dictionaries_1, ...dictionaries_2], null, 2))
}

async function load_saved_dictionaries() {
  const dictionaries = (await import('./firestore-data/dictionaries.json')).default
  return dictionaries
}

// get managers using collection group from dictionaries/{dictionary_id}/managers
async function get_managers_by_dictionary_id() {
  const fb_managers: Record<string, IHelper[]> = {}
  const snapshot = await db.collectionGroup('managers').get()
  snapshot.forEach((doc) => {
    const data = doc.data() as IHelper
    const dictionaryId = doc.ref.parent.parent?.id

    if (dictionaryId) {
      if (!fb_managers[dictionaryId]) {
        fb_managers[dictionaryId] = []
      }
      fb_managers[dictionaryId].push(data)
    } else {
      console.log('no dictionary id found for manager')
    }
  })
  return fb_managers
}

// get contributors using collection group from dictionaries/{dictionary_id}/contributors
async function get_contributors_by_dictionary_id() {
  const fb_contributors: Record<string, IHelper[]> = {}
  const snapshot = await db.collectionGroup('contributors').get()
  snapshot.forEach((doc) => {
    const data = doc.data() as IHelper
    const dictionaryId = doc.ref.parent.parent?.id

    if (dictionaryId) {
      if (!fb_contributors[dictionaryId]) {
        fb_contributors[dictionaryId] = []
      }
      fb_contributors[dictionaryId].push(data)
    } else {
      console.log('no dictionary id found for contributor')
    }
  })
  return fb_contributors
}

// get writeInCollaborators using collection group from dictionaries/{dictionary_id}/writeInCollaborators
async function get_writeInCollaborators_by_dictionary_id() {
  const fb_writeInCollaborators: Record<string, IHelper[]> = {}
  const snapshot = await db.collectionGroup('writeInCollaborators').get()
  snapshot.forEach((doc) => {
    const data = doc.data() as IHelper
    const dictionaryId = doc.ref.parent.parent?.id

    if (dictionaryId) {
      if (!fb_writeInCollaborators[dictionaryId]) {
        fb_writeInCollaborators[dictionaryId] = []
      }
      fb_writeInCollaborators[dictionaryId].push(data)
    } else {
      console.log('no dictionary id found for writeInCollaborator')
    }
  })
  return fb_writeInCollaborators
}

// get partners using collection group from dictionaries/{dictionary_id}/partners
async function get_partners_by_dictionary_id() {
  const fb_partners: Record<string, Partner[]> = {}
  const snapshot = await db.collectionGroup('partners').get()
  snapshot.forEach((doc) => {
    const data = doc.data() as Partner
    const dictionaryId = doc.ref.parent.parent?.id

    if (dictionaryId) {
      if (!fb_partners[dictionaryId]) {
        fb_partners[dictionaryId] = []
      }
      fb_partners[dictionaryId].push(data)
    } else {
      console.log('no dictionary id found for partner')
    }
  })
  return fb_partners
}

// get invites using collection group from dictionaries/{dictionary_id}/invites
async function get_invites_by_dictionary_id() {
  const fb_invites: Record<string, IInvite[]> = {}
  const snapshot = await db.collectionGroup('invites').get()
  snapshot.forEach((doc) => {
    const data = doc.data() as IInvite
    const dictionaryId = doc.ref.parent.parent?.id

    if (dictionaryId) {
      if (!fb_invites[dictionaryId]) {
        fb_invites[dictionaryId] = []
      }
      fb_invites[dictionaryId].push(data)
    } else {
      console.log('no dictionary id found for invite')
    }
  })
  return fb_invites
}

// get about, grammar, citation using collection group from dictionaries/{dictionary_id}/info/about (about/grammar/citation is the doc id)
async function get_info_by_dictionary_id() {
  const fb_dictionary_info: Record<string, {
    about?: string
    grammar?: string
    citation?: string
    createdBy?: string
    updatedBy?: string
  }> = {}
  const snapshot = await db.collectionGroup('info').get()
  snapshot.forEach((doc) => {
    const data = doc.data() as IAbout & IGrammar & Citation
    const dictionaryId = doc.ref.parent.parent?.id

    let info_type: 'about' | 'grammar' | 'citation'
    if (doc.id === 'about') {
      info_type = 'about'
    } else if (doc.id === 'grammar') {
      info_type = 'grammar'
    } else if (doc.id === 'citation') {
      info_type = 'citation'
    } else {
      throw new Error('info type not found')
    }

    if (!data[info_type]) {
      return
    }

    if (dictionaryId) {
      if (!fb_dictionary_info[dictionaryId]) {
        fb_dictionary_info[dictionaryId] = {}
      }
      fb_dictionary_info[dictionaryId][info_type] = data[info_type]
      if (data.createdBy) {
        fb_dictionary_info[dictionaryId].createdBy = data.createdBy
      }
      if (data.updatedBy) {
        fb_dictionary_info[dictionaryId].updatedBy = data.updatedBy
      }
    } else {
      console.log('no dictionary id found for info')
    }
  })
  return fb_dictionary_info
}
