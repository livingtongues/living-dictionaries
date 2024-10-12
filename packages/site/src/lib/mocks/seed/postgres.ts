import PG from 'pg' // import all because library is not written for ESM yet

export async function execute_sql_query_on_db(query: string) {
  const client = new PG.Client({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'postgres',
    password: 'postgres',
    port: 54322,
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
    connectionTimeoutMillis: 2000,
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
      // console.info(result.rows)
    } catch (error) {
      console.error('Error executing query:', error)
    } finally {
      client.release()
    }
  }
}

export const postgres = new DB()
