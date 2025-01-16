import fs from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { UserRecord } from 'firebase-admin/auth'
import { auth } from '../config-firebase'
import { admin_supabase, postgres } from '../config-supabase'
import { write_users_insert } from './write-users-insert'

export async function migrate_users() {
  const users = await get_users()
  console.log({ total_users: users.length })
  for (const user of users)
    console.log(user.email)
  for (const user of users)
    console.log(user.toJSON())
  const sql = write_users_insert(users)
  console.log(sql)
  await postgres.execute_query(sql)
}

const BATCH_SIZE = 1000

async function get_users(): Promise<UserRecord[]> {
  try {
    const listUsersResult = await auth.listUsers()
    const { users, pageToken } = listUsersResult

    console.log({ users: users.length, pageToken })

    if (pageToken) {
      const listUsersResult = await auth.listUsers(BATCH_SIZE, pageToken)
      const { users: nextUsers } = listUsersResult
      // const nextUsers = await get_users(pageToken) // had issue
      return [...users, ...nextUsers]
    }

    return users
  } catch (error) {
    console.log({ list_error: error })
  }
}

const FOLDER = 'firestore-data'
const __dirname = dirname(fileURLToPath(import.meta.url))

export async function write_users() {
  const users = await get_users()

  console.log(`Done fetching ${users.length} users.`)

  fs.writeFileSync(path.resolve(__dirname, FOLDER, 'firestore-users.json'), JSON.stringify(users, null, 2))
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
      await postgres.execute_query(sql)
    }
  }

  console.log({ unmatched_firebase: unmatched_firebase.length, sb_users: sb_users.length, firebase_users: firebase_users.length, supabase_users_not_in_firebase: supabase_users_not_in_firebase.size })

  fs.writeFileSync(path.resolve(__dirname, FOLDER, 'fb-sb-user-ids.json'), JSON.stringify(firebase_uid_to_supabase_user_id, null, 2))
}
