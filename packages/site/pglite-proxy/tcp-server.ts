import type { ConnectionManager } from './connection-manager.js'
import net from 'node:net'
import { fromNodeSocket } from 'pg-gateway/node'

export function create_tcp_server(connection_manager: ConnectionManager, port: number) {
  const server = net.createServer(async (socket) => {
    console.log('[pglite-proxy] Postgres client connecting...')

    if (!connection_manager.has_browser()) {
      console.log('[pglite-proxy] No browser connected, rejecting client')
      socket.end()
      return
    }

    if (connection_manager.has_connection()) {
      console.log('[pglite-proxy] Another client already connected, rejecting')
      socket.end()
      return
    }

    try {
      const connection = await fromNodeSocket(socket, {
        serverVersion: '16.3 (PGlite)',
        auth: { method: 'trust' },

        onStartup() {
          if (!connection_manager.has_browser()) {
            throw new Error('Browser is not sharing the database')
          }
          connection_manager.set_connection(connection)
          console.log('[pglite-proxy] Postgres client connected via TCP')
        },

        async onMessage(data, state) {
          if (!state.isAuthenticated) return
          if (!connection_manager.has_browser()) {
            throw new Error('Browser connection lost')
          }

          try {
            const response = await connection_manager.send_to_browser(data)
            connection_manager.write_to_client(response)
            return new Uint8Array()
          } catch (error) {
            console.error('[pglite-proxy] Error forwarding to browser:', error)
            throw new Error('Failed to communicate with browser')
          }
        },
      })

      socket.on('close', () => {
        connection_manager.remove_connection()
      })

      socket.on('error', (error) => {
        console.error('[pglite-proxy] TCP socket error:', error)
        connection_manager.remove_connection()
      })
    } catch (error) {
      console.error('[pglite-proxy] Error creating Postgres connection:', error)
      socket.end()
    }
  })

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[pglite-proxy] TCP port ${port} already in use - psql proxy unavailable`)
    } else {
      console.error('[pglite-proxy] TCP server error:', error)
    }
  })

  server.listen(port, '127.0.0.1')

  return server
}
