import PG from 'pg' // import all because library is not written for ESM yet

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
      // console.info(result.rows)
    } catch (error) {
      console.error('Error executing query:', error)
    } finally {
      client.release()
    }
  }
}

export const postgres = new DB()
