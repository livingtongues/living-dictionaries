import PG from 'pg'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@living-dictionaries/site/src/lib/supabase/database.types'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.supabase' })

export const supabase = createClient<Database>(process.env.PUBLIC_SUPABASE_API_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function executeQuery(query: string) {
  const client = new PG.Client({
    user: 'postgres',
    host: '127.0.0.1',
    // host: 'db.actkqboqpzniojhgtqzw.supabase.co',
    database: 'postgres',
    password: 'postgres',
    // password: '**',
    port: 54322,
    // port: 5432,
  })
  try {
    await client.connect()
    await client.query(query)
  } catch (error) {
    console.error('Error in connection/executing query:', error)
  } finally {
    await client.end().catch((error) => {
      console.error('Error ending client connection:', error)
    })
  }
}
