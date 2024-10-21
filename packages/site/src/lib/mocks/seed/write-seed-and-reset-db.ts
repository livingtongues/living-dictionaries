import { writeFileSync } from 'node:fs'
import { sql_file_string } from './to-sql-string'
import { seed_dictionaries, seed_entries, users } from './tables'
import { postgres } from '$lib/mocks/seed/postgres'

function sql_string_for_all_seeded_tables() {
  return `${sql_file_string('auth.users', users)}
  ${sql_file_string('dictionaries', seed_dictionaries)}
  ${sql_file_string('entries', seed_entries)}
  `
}

export async function reset_db() {
  console.info('reseting db')

  await postgres.execute_query(`truncate table auth.users cascade;`)
  await postgres.execute_query('truncate table senses cascade;')

  const seed_sql = sql_string_for_all_seeded_tables()
  await postgres.execute_query(seed_sql)
}

export function write_seed() {
  console.info('writing seed sql to supabase/seed.sql')
  const seedFilePath = '../../supabase/seed.sql'
  const seed_sql = sql_string_for_all_seeded_tables()
  writeFileSync(seedFilePath, seed_sql)
}
