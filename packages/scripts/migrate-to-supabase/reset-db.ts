// import { readFileSync } from 'node:fs'
import { execute_query, jacob_ld_user_id } from '../config-supabase'

export async function reset_db() {
  console.info('reseting db from seed sql')

  await execute_query(`truncate table auth.users cascade;`)
  await execute_query('truncate table senses cascade;')

  // const seedFilePath = '../../supabase/seed.sql'
  // const seed_sql = readFileSync(seedFilePath, 'utf8')
  // await execute_query(seed_sql)

  const add_user_sql = `INSERT INTO auth.users ("aud", "email", "id", "instance_id", "role") VALUES
('authenticated', 'jacob@livingtongues.org', '${jacob_ld_user_id}', '00000000-0000-0000-0000-000000000000', 'authenticated');`
  await execute_query(add_user_sql)
}
