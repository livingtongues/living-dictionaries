import { admin_supabase, anon_supabase } from './clients'
import { seeded_user_email_1, seeded_user_id_1 } from '$lib/mocks/seed/tables'
import { reset_db } from '$lib/mocks/seed/write-seed-and-reset-db'

describe('users table access', () => {
  beforeEach(async () => {
    await reset_db()
  })

  test('admin can check user emails', async () => {
    const { data } = await admin_supabase.from('user_emails').select().eq('id', seeded_user_id_1).single()
    expect(data.email).toEqual(seeded_user_email_1)
  })

  test('normal users cannot check user emails', async () => {
    const { data } = await anon_supabase.from('user_emails').select().eq('id', seeded_user_id_1).single()
    expect(data).toBeNull()
  })
})
