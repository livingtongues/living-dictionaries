import type { Plugin } from 'vite'

const WS_PORT = 4000
const TCP_PORT = 5432
const HTTP_PORT = 4001

export function pglite_proxy(): Plugin {
  let cleanup: (() => void) | null = null

  return {
    name: 'pglite-proxy',
    apply: 'serve',

    async configureServer() {
      const { start_servers } = await import('./servers.js')
      cleanup = start_servers({ ws_port: WS_PORT, tcp_port: TCP_PORT, http_port: HTTP_PORT })

      console.log('')
      console.log('='.repeat(60))
      console.log('PGLite Proxy Server Started')
      console.log('='.repeat(60))
      console.log('')
      console.log(`WebSocket server: ws://localhost:${WS_PORT}`)
      console.log(`TCP server:       localhost:${TCP_PORT}`)
      console.log(`HTTP server:      http://localhost:${HTTP_PORT}`)
      console.log('')
      console.log('HTTP API:')
      console.log(`  GET  /clients           - List connected browsers`)
      console.log(`  POST /query?client=ID   - Execute SQL on client`)
      console.log('')
      console.log('='.repeat(60))
    },

    buildEnd() {
      cleanup?.()
    },
  }
}
