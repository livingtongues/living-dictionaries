import { postgres } from '$lib/mocks/seed/postgres'
import { admin_supabase, anon_supabase, incremental_consistent_uuid, PASSWORD } from './clients'

const reset_db_sql = `truncate table auth.users cascade;`

const USER_1_ID = incremental_consistent_uuid(43)
const USER_1_EMAIL = `user1-${USER_1_ID}@test.com`

describe('users table access', () => {
  beforeAll(async () => {
    await postgres.execute_query(reset_db_sql)

    await admin_supabase.auth.admin.createUser({
      id: USER_1_ID,
      email: USER_1_EMAIL,
      password: PASSWORD,
      email_confirm: true,
    })
  })

  test('admin can check user emails', async () => {
    const { data } = await admin_supabase.from('user_emails').select().eq('id', USER_1_ID).single()
    expect(data.email).toEqual(USER_1_EMAIL)
  })

  test('normal users cannot check user emails', async () => {
    const { data } = await anon_supabase.from('user_emails').select().eq('id', USER_1_ID).single()
    expect(data).toBeNull()
  })
})
