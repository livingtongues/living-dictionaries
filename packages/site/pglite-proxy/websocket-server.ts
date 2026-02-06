import type { ConnectionManager } from './connection-manager.js'
import { type WebSocket, WebSocketServer } from 'ws'

export function create_websocket_server(connection_manager: ConnectionManager, port: number) {
  const wss = new WebSocketServer({ port })

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url ?? '', `http://localhost:${port}`)
    const client_id = url.searchParams.get('client_id')

    if (!client_id) {
      console.log('[pglite-proxy] Browser connection rejected: missing client_id')
      ws.close(4000, 'client_id required')
      return
    }

    console.log(`[pglite-proxy] Browser connecting: ${client_id}`)
    connection_manager.set_websocket(client_id, ws)

    ws.on('message', (data: Buffer) => {
      const uint8_data = new Uint8Array(data)
      connection_manager.handle_browser_response(client_id, uint8_data)
    })

    ws.on('close', () => {
      connection_manager.remove_websocket(client_id)
    })

    ws.on('error', (error) => {
      console.error(`[pglite-proxy] WebSocket error for ${client_id}:`, error)
      connection_manager.remove_websocket(client_id)
    })
  })

  wss.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[pglite-proxy] WebSocket port ${port} already in use - proxy WebSocket unavailable`)
    } else {
      console.error('[pglite-proxy] WebSocket server error:', error)
    }
  })

  return wss
}
