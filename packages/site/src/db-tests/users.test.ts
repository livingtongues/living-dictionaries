import { seed_user_email_1, seeded_user_id_1 } from '$lib/mocks/seed/tables';
import { reset_db } from '$lib/mocks/seed/write-seed-and-reset-db';
import { admin_supabase, anon_supabase } from './clients';

beforeAll(async () => {
  await reset_db()
})

describe('users table access', () => {
  test('admin can check user emails', async () => {
    const { data } = await admin_supabase.from('users').select().eq('id', seeded_user_id_1).single()
    expect(data.email).toEqual(seed_user_email_1);
  });

  test('normal users cannot check user emails', async () => {
    const { data } = await anon_supabase.from('users').select().eq('id', seeded_user_id_1).single()
    expect(data).toBeNull();
  });
});

