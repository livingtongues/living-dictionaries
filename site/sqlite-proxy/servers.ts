import { ConnectionManager } from './connection-manager.js'
import { create_http_server } from './http-server.js'
import { create_websocket_server } from './websocket-server.js'

interface ServerOptions {
  ws_port: number
  http_port: number
}

/**
 * Boots both servers + shared ConnectionManager. Returns a cleanup fn for
 * the vite plugin's buildEnd hook.
 */
export function start_servers({ ws_port, http_port }: ServerOptions) {
  const connection_manager = new ConnectionManager()

  const wss = create_websocket_server(connection_manager, ws_port)
  const http_server = create_http_server(connection_manager, http_port)

  return function cleanup() {
    wss.close()
    http_server.close()
  }
}
