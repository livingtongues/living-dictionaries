import type { ConnectionManager } from './connection-manager.js'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'

/**
 * WebSocket endpoint browsers connect to with `?client_id=<id>`. Each
 * connection becomes a query channel: HTTP /query → ConnectionManager →
 * ws.send → browser executes → ws.on('message') → resolves the pending
 * promise.
 */
export function create_websocket_server(connection_manager: ConnectionManager, port: number) {
  const wss = new WebSocketServer({ port })

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url ?? '', `http://localhost:${port}`)
    const client_id = url.searchParams.get('client_id')

    if (!client_id) {
      console.info('[sqlite-proxy] Browser connection rejected: missing client_id')
      ws.close(4000, 'client_id required')
      return
    }

    connection_manager.set_websocket(client_id, ws)

    ws.on('message', (data: Buffer) => {
      connection_manager.handle_browser_response(client_id, new Uint8Array(data))
    })

    ws.on('close', () => {
      connection_manager.remove_websocket(client_id)
    })

    ws.on('error', (err) => {
      console.error(`[sqlite-proxy] WebSocket error for ${client_id}:`, err)
      connection_manager.remove_websocket(client_id)
    })
  })

  wss.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE')
      console.error(`[sqlite-proxy] WebSocket port ${port} already in use - proxy WebSocket unavailable`)
    else
      console.error('[sqlite-proxy] WebSocket server error:', err)
  })

  return wss
}
