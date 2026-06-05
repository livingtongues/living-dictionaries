import type { ConnectionManager } from './connection-manager.js'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Tiny HTTP API the agent CLI talks to. Two routes:
 *   GET  /clients          — JSON list of connected admin/editor browsers
 *   POST /query?client=ID  — relays {sql, params} to that browser via WS,
 *                            returns rows when the browser responds
 *
 * CORS wide-open because the agent + arbitrary local tools may hit it from
 * different origins. There's no auth — this is dev-only and listens on
 * 127.0.0.1 implicitly (Node default with no host).
 */
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
      const clients = connection_manager.get_clients()
      const client_id = url.searchParams.get('client') ?? clients[0]?.id
      if (!client_id) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'No browser connected' }))
        return
      }

      if (!connection_manager.has_browser(client_id)) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: `Client not connected: ${client_id}` }))
        return
      }

      let body = ''
      for await (const chunk of req)
        body += chunk

      let sql: string
      let params: unknown[]
      try {
        const parsed = JSON.parse(body)
        ;({ sql } = parsed)
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
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }))
      }
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE')
      console.error(`[sqlite-proxy] HTTP port ${port} already in use - proxy HTTP API unavailable`)
    else
      console.error('[sqlite-proxy] HTTP server error:', err)
  })

  server.listen(port)
  return server
}
