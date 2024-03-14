import { execute_sql_query_on_db } from './postgres'
import { writeFileSync } from 'fs'
import { sql_file_string } from './to-sql-string'
import { users, entry_updates, seed_dictionaries } from './tables'

function sql_string_for_all_seeded_tables() {
  return `${sql_file_string('auth.users', users)}

${sql_file_string('dictionaries', seed_dictionaries)}

${sql_file_string('entry_updates', entry_updates)}

`
}
// ${sql_file_string('content_updates', content_updates)}

export async function reset_db() {
  console.info('reseting db from seed sql')

  await execute_sql_query_on_db(`truncate table auth.users cascade;`)
  await execute_sql_query_on_db('truncate table entry_updates;')

  const seed_sql = sql_string_for_all_seeded_tables()
  await execute_sql_query_on_db(seed_sql)
}

export function write_seed() {
  console.info('writing seed sql to supabase/seed.sql')
  const seedFilePath = '../../supabase/seed.sql'
  const seed_sql = sql_string_for_all_seeded_tables()
  writeFileSync(seedFilePath, seed_sql)
}
