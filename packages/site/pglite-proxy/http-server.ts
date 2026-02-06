import type { ConnectionManager } from './connection-manager.js'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

export function create_http_server(connection_manager: ConnectionManager, port: number) {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url ?? '', `http://localhost:${port}`)
    const { pathname } = url

    if (pathname === '/clients' && req.method === 'GET') {
      const clients = connection_manager.get_clients()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ clients }))
      return
    }

    if (pathname === '/query' && req.method === 'POST') {
      const client_id = url.searchParams.get('client')
      if (!client_id) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'client query param required' }))
        return
      }

      if (!connection_manager.has_browser(client_id)) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: `Client not connected: ${client_id}` }))
        return
      }

      let body = ''
      for await (const chunk of req) {
        body += chunk
      }

      let sql: string
      let params: unknown[] = []
      try {
        const parsed = JSON.parse(body)
        sql = parsed.sql
        params = parsed.params ?? []
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }))
        return
      }

      try {
        const result = await connection_manager.send_sql_to_browser(sql, params, client_id)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(result)
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }))
      }
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  })

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[pglite-proxy] HTTP port ${port} already in use - proxy HTTP API unavailable`)
    } else {
      console.error('[pglite-proxy] HTTP server error:', error)
    }
  })

  server.listen(port)
  return server
}
