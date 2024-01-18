import PG from 'pg'

export async function executeQuery(query: string) {
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
