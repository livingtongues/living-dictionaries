import { writeFileSync } from 'node:fs'
import { anon_supabase, postgres } from '../config-supabase'
import type { Upload_Operations } from './generate-sql-statements'
import { generate_sql_statements } from './generate-sql-statements'
import type { Row } from './row.type'

export async function import_data({
  dictionary_id,
  rows,
  import_id,
  upload_operations,
  live = false,
}: {
  dictionary_id: string
  rows: Row[]
  import_id: string
  upload_operations: Upload_Operations
  live: boolean
}) {
  const { data: dialects } = await anon_supabase.from('dialects').select('id, name').eq('dictionary_id', dictionary_id)
  const { data: speakers } = await anon_supabase.from('speakers').select('id, name').eq('dictionary_id', dictionary_id)
  const { data: tags } = await anon_supabase.from('tags').select('id, name').eq('dictionary_id', dictionary_id)

  const start_index = 0
  const batch_size = 30000
  const end_index = start_index + batch_size
  let sql_query = 'BEGIN;' // Start a transaction

  for await (const [index, row] of rows.entries()) {
    if (!row.lexeme)
      continue

    if (index >= start_index && index < end_index) {
      console.info(index)
      const sql_statements = await generate_sql_statements({ row, dictionary_id, import_id, speakers, dialects, tags, upload_operations })
      sql_query += `${sql_statements}\n`

      if (index % 500 === 0)
        console.log(`import reached ${index}`)
    }
  }

  sql_query += '\nCOMMIT;' // End the transaction

  try {
    if (!process.env.CI) {
      writeFileSync(`./logs/${Date.now()}_${dictionary_id}-${start_index}-query.sql`, sql_query)
    }
    if (live) {
      console.log('executing sql query')
      await postgres.execute_query(sql_query)
      console.log('finished')
    }
  } catch (err) {
    console.error(err)
    if (live) {
      await postgres.execute_query('ROLLBACK;') // Rollback the transaction in case of error
    }
  }

  return sql_query
}
