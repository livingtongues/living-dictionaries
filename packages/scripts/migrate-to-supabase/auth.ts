import type { UserRecord } from 'firebase-admin/auth'
import { auth } from '../config-firebase'
import { execute_query } from '../config-supabase'
import { write_users_insert } from './write-users-insert'

migrate_users()

async function migrate_users() {
  const users = await get_users()
  console.log({ total_users: users.length })
  for (const user of users)
    console.log(user.email)
  for (const user of users)
    console.log(user.toJSON())
  const sql = write_users_insert(users)
  console.log(sql)
  await execute_query(sql)
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
      // const nextUsers = await get_users(pageToken)
      return [...users, ...nextUsers]
    }

    return users
  } catch (error) {
    console.log({ list_error: error })
  }
}
