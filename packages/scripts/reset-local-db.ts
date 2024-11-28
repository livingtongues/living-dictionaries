// import { readFileSync } from 'node:fs'
import { diego_ld_user_id, environment, jacob_ld_user_id, postgres, test_dictionary_id } from './config-supabase'

export async function reset_local_db() {
  if (environment === 'prod') {
    console.error('cannot reset db in production')
    return
  }

  console.info('reseting db from seed sql')

  await postgres.execute_query(`truncate table auth.users cascade;`)
  await postgres.execute_query('truncate table entry_updates cascade;')

  // const seedFilePath = '../../supabase/seed.sql'
  // const seed_sql = readFileSync(seedFilePath, 'utf8')
  // await postgres.execute_query(seed_sql)

  const add_user_and_dictionary_sql = `INSERT INTO auth.users ("aud", "email", "id", "instance_id", "role") VALUES
('authenticated', 'jacob@livingtongues.org', '${jacob_ld_user_id}', '00000000-0000-0000-0000-000000000000', 'authenticated'),
('authenticated', 'diego@livingtongues.org', '${diego_ld_user_id}', '00000000-0000-0000-0000-000000000000', 'authenticated');

INSERT INTO "public"."dictionaries" ("id", "name", "created_at", "created_by", "updated_at", "updated_by") VALUES
('${test_dictionary_id}', 'Test Dictionary', '2024-03-18 14:16:22.367188+00', '${diego_ld_user_id}', '2024-03-18 14:16:22.367188+00', '${diego_ld_user_id}');`
  await postgres.execute_query(add_user_and_dictionary_sql)
}
