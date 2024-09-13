import { readFileSync } from 'node:fs'
import { execute_query } from '../config-supabase'

export async function reset_db() {
  console.info('reseting db from seed sql')

  await execute_query(`truncate table auth.users cascade;`)
  await execute_query('truncate table senses cascade;')

  const seedFilePath = '../../supabase/seed.sql'
  const seed_sql = readFileSync(seedFilePath, 'utf8')
  await execute_query(seed_sql)
}
