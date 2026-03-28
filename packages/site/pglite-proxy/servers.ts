import { ConnectionManager } from './connection-manager.js'
import { create_http_server } from './http-server.js'
import { create_tcp_server } from './tcp-server.js'
import { create_websocket_server } from './websocket-server.js'

interface ServerOptions {
  ws_port: number
  tcp_port: number
  http_port: number
}

export function start_servers({ ws_port, tcp_port, http_port }: ServerOptions) {
  const connection_manager = new ConnectionManager()

  const wss = create_websocket_server(connection_manager, ws_port)
  const tcp_server = create_tcp_server(connection_manager, tcp_port)
  const http_server = create_http_server(connection_manager, http_port)

  return function cleanup() {
    wss.close()
    tcp_server.close()
    http_server.close()
  }
}
