import { execute_sql_query_on_db } from './postgres'
import { sql_string_for_all_seeded_tables } from './to-sql-string'
import { writeFileSync } from 'fs'

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
