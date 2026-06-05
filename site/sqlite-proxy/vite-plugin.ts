import type { Plugin } from 'vite'

/**
 * Port mapping derived from Vite's port — each vite instance gets a dedicated
 * pair so `pnpm dev` (3041) and `pnpm prod` (3042, vite's strictPort:false
 * fallback when dev already holds 3041) can run in parallel without clashing.
 *
 *   vite 3041 (`pnpm dev`)        → ws 4050, http 4051
 *   vite 3042 (`pnpm prod`)       → ws 4052, http 4053
 *   vite 3043 (vite auto-fallback)→ ws 4054, http 4055
 *
 * Base anchored to LD's actual dev port (3041, see `vite.config.ts`). The
 * 4050-range proxy ports leave tutor's 4000-range and house's 4020-range free
 * for parallel local dev across all three repos. Must stay in sync with
 * `live-share.svelte.ts`'s port math and `scripts/sqlite-query.sh`.
 */
const BASE_VITE_PORT = 3041
const BASE_WS_PORT = 4050
const BASE_HTTP_PORT = 4051

function get_proxy_ports(vite_port: number) {
  const offset = (vite_port - BASE_VITE_PORT) * 2
  return {
    ws_port: BASE_WS_PORT + offset,
    http_port: BASE_HTTP_PORT + offset,
  }
}

/**
 * Dev-only Vite plugin (`apply: 'serve'`) that boots an HTTP + WebSocket
 * server pair beside the Vite dev server. Browsers' admin/dict wa-sqlite
 * connects to the WS with their email (and `::dict::<id>` for per-dict DBs) as
 * client_id (see `live-share.svelte.ts`, wired in the admin + `[dictionaryId]`
 * layouts); agents/CLIs send SQL via the HTTP `/query` endpoint and get back
 * JSON rows. See `.claude/skills/sqlite-query/SKILL.md`.
 *
 * Skips entirely in build/preview because production has no need (and prod
 * doesn't expose 4050+ ports anyway).
 */
export function sqlite_proxy(): Plugin {
  let cleanup: (() => void) | null = null

  return {
    name: 'sqlite-proxy',
    apply: 'serve',

    configureServer(server) {
      const http_server = server.httpServer
      if (!http_server)
        return

      // Derive ports from the ACTUAL bound vite port, not the configured one.
      // With `strictPort: false`, vite falls back (3041 → 3042 → …) but
      // `server.config.server.port` still reports the configured 3041, which
      // would make a second instance collide on 4050/4051. Reading the real
      // port off the listening socket keeps parallel dev/prod instances apart.
      http_server.once('listening', async () => {
        const address = http_server.address()
        const vite_port = typeof address === 'object' && address ? address.port : BASE_VITE_PORT
        const { ws_port, http_port } = get_proxy_ports(vite_port)

        const { start_servers } = await import('./servers.js')
        cleanup = start_servers({ ws_port, http_port })

        log_banner({ ws_port, http_port })
      })
    },

    buildEnd() {
      cleanup?.()
    },
  }
}

function log_banner({ ws_port, http_port }: { ws_port: number, http_port: number }) {
  console.info('')
  console.info('='.repeat(60))
  console.info('SQLite Proxy Server Started')
  console.info('='.repeat(60))
  console.info('')
  console.info(`WebSocket server: ws://localhost:${ws_port}`)
  console.info(`HTTP server:      http://localhost:${http_port}`)
  console.info('')
  console.info('HTTP API:')
  console.info(`  GET  /clients           - List connected browsers`)
  console.info(`  POST /query?client=ID   - Execute SQL on client`)
  console.info('')
  console.info('='.repeat(60))
}
