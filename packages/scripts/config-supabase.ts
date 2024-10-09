import PG from 'pg'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@living-dictionaries/types'
import * as dotenv from 'dotenv'
import './record-logs'

// TODO: change to .env.development and .env.production
dotenv.config({ path: '.env.supabase' }) // local project variables

export const admin_supabase = createClient<Database>(process.env.PUBLIC_SUPABASE_API_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
export const anon_supabase = createClient<Database>(process.env.PUBLIC_SUPABASE_API_URL, process.env.PUBLIC_SUPABASE_ANON_KEY)
export const jacob_ld_user_id = 'de2d3715-6337-45a3-a81a-d82c3210b2a7'

export async function execute_query(query: string) {
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

const environment = 'dev'
console.log(`Supabase running on ${environment}`)
