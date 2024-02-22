import { execute_sql_query_on_db } from './postgres'
import { writeFileSync } from 'fs'
import { sql_file_string } from './to-sql-string'
import { users, entry_updates, sentence_updates } from './tables'

function sql_string_for_all_seeded_tables() {
  return `${sql_file_string('auth.users', users)}

${sql_file_string('entry_updates', entry_updates)}

${sql_file_string('sentence_updates', sentence_updates)}
`
}

async function write_seed_and_reset_db() {
  console.info('reseting db from seed sql')

  await execute_sql_query_on_db(`truncate table auth.users cascade;`)
  await execute_sql_query_on_db('truncate table entry_updates;')

  const seed_sql = sql_string_for_all_seeded_tables()
  await execute_sql_query_on_db(seed_sql)

  console.info('writing seed sql to supabase/seed.sql')
  const seedFilePath = '../../supabase/seed.sql'
  writeFileSync(seedFilePath, seed_sql)
}

write_seed_and_reset_db()
