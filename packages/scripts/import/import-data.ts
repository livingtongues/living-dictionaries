import { writeFileSync } from 'node:fs'
import { admin_supabase, postgres } from '../config-supabase'
import { generate_sql_statements } from './generate-sql-statements'
import type { Row } from './row.type'

export async function import_data({
  dictionary_id,
  rows,
  import_id,
  live = false,
}: {
  dictionary_id: string
  rows: Row[]
  import_id: string
  live: boolean
}) {
  const { data: dialects } = await admin_supabase.from('dialects').select('id, name').eq('dictionary_id', dictionary_id)
  const { data: speakers } = await admin_supabase.from('speakers').select('id, name').eq('dictionary_id', dictionary_id)

  const start_index = 0
  const batch_size = 30000
  const end_index = start_index + batch_size
  let sql_query = 'BEGIN;' // Start a transaction

  for await (const [index, row] of rows.entries()) {
    if (!row.lexeme)
      continue

    if (index >= start_index && index < end_index) {
      console.info(index)
      const sql_statements = generate_sql_statements({ row, dictionary_id, import_id, speakers, dialects })
      sql_query += `${sql_statements}\n`

      if (index % 500 === 0)
        console.log(`import reached ${index}`)
    }
  }

  sql_query += '\nCOMMIT;' // End the transaction

  try {
    writeFileSync(`./logs/${Date.now()}_${dictionary_id}-${start_index}-query.sql`, sql_query)
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
}
