import type { Database } from '@living-dictionaries/types'
import { createClient } from '@supabase/supabase-js'
import PG from 'pg' // import all because library is not written for ESM yet

// local keys from .env.development - ok to commit
export const PUBLIC_SUPABASE_API_URL = 'http://127.0.0.1:54321'
export const PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
export const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'

export const admin_supabase = createClient<Database>(PUBLIC_SUPABASE_API_URL, SUPABASE_SERVICE_ROLE_KEY)
export const anon_supabase = createClient<Database>(PUBLIC_SUPABASE_API_URL, PUBLIC_SUPABASE_ANON_KEY)

export const PASSWORD = 'password123'

export function generate_uuid(index: number): string {
  return '22222222-2222-2222-2222-222222222222'.slice(0, -6) + index.toString().padStart(6, '0')
}

class DB {
  private pool: PG.Pool

  private config: PG.PoolConfig = {
    user: 'postgres',
    host: '127.0.0.1',
    database: 'postgres',
    password: 'postgres',
    port: 54322,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: false,
  }

  async get_db_connection(): Promise<PG.PoolClient> {
    if (!this.pool) {
      this.pool = new PG.Pool(this.config)
      const client = await this.pool.connect()
      console.info(`----> √ Postgres DB connection established! <----`)
      return client
    }
    return this.pool.connect()
  }

  async execute_query(query: string): Promise<void> {
    const client = await this.get_db_connection()
    try {
      await client.query(query)
    } catch (error) {
      console.error('Error executing query:', error)
      throw error
    } finally {
      client.release()
    }
  }

  async query<T>(query: string, params?: any[]): Promise<PG.QueryResult<T>> {
    const client = await this.get_db_connection()
    try {
      return await client.query<T>(query, params)
    } finally {
      client.release()
    }
  }
}

export const supabase_pg = new DB()
