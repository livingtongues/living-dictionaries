import { program } from 'commander'
import PG from 'pg'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@living-dictionaries/types'
import * as dotenv from 'dotenv'
import './record-logs'

program
  .option('-e, --environment [dev/prod]', 'Firebase/Supabase Project', 'dev')
  .allowUnknownOption() // because config is shared by multiple scripts
  .parse(process.argv)

export const environment = program.opts().environment === 'prod' ? 'prod' : 'dev'
console.log(`Supabase running on ${environment}`)

if (environment === 'dev') {
  dotenv.config({ path: '../site/.env.development' })
} else {
  dotenv.config({ path: '.env.production.supabase' })
}

export const admin_supabase = createClient<Database>(process.env.PUBLIC_SUPABASE_API_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
export const anon_supabase = createClient<Database>(process.env.PUBLIC_SUPABASE_API_URL, process.env.PUBLIC_SUPABASE_ANON_KEY)
export const jacob_ld_user_id = 'de2d3715-6337-45a3-a81a-d82c3210b2a7'

class DB {
  private pool: PG.Pool

  private config: PG.PoolConfig = {
    ...(environment === 'dev'
      ? {
          user: 'postgres',
          host: '127.0.0.1',
          database: 'postgres',
          password: 'postgres',
          port: 54322,
        }
      : {
          user: 'postgres.actkqboqpzniojhgtqzw',
          host: 'aws-0-us-west-1.pooler.supabase.com',
          database: 'postgres',
          password: process.env.SUPABASE_DB_PASSWORD,
          port: 6543,
        }),
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
      // @ts-expect-error
      throw new Error(error)
    } finally {
      client.release()
    }
  }
}

export const postgres = new DB()
