import type { WebSocket } from 'ws'

interface ClientConnection {
  websocket: WebSocket
  connected_at: Date
  pending_sql_resolve: ((data: string) => void) | null
}

/**
 * Tracks live browser connections to the dev-only sqlite proxy. Each admin or
 * editor tab registers with a `client_id` — `<email>` for the admin shared.db,
 * `<email>::dict::<dict_id>` for a per-dict dict.db (see `live-share.svelte.ts`).
 * The agent's CLI (curl /clients → POST /query) reaches the browser by that id,
 * the proxy fans out SQL via the websocket, and resolves a pending promise when
 * the browser ships back the result rows.
 *
 * Single in-flight query per client. If a second query lands before the first
 * resolves, the old `pending_sql_resolve` is overwritten — first caller hangs.
 * Fine for interactive debugging.
 */
export class ConnectionManager {
  private clients = new Map<string, ClientConnection>()

  set_websocket(client_id: string, ws: WebSocket) {
    const existing = this.clients.get(client_id)
    if (existing) {
      console.info(`[sqlite-proxy] Replacing existing WebSocket for client: ${client_id}`)
      existing.websocket.close()
    }
    this.clients.set(client_id, {
      websocket: ws,
      connected_at: new Date(),
      pending_sql_resolve: null,
    })
    console.info(`[sqlite-proxy] Browser connected: ${client_id}`)
  }

  remove_websocket(client_id: string) {
    this.clients.delete(client_id)
    console.info(`[sqlite-proxy] Browser disconnected: ${client_id}`)
  }

  get_clients(): { id: string, connected_at: Date }[] {
    return Array.from(this.clients.entries()).map(([id, conn]) => ({
      id,
      connected_at: conn.connected_at,
    }))
  }

  has_browser(client_id: string): boolean {
    const client = this.clients.get(client_id)
    return client !== undefined && client.websocket.readyState === 1
  }

  send_sql_to_browser(sql: string, params: unknown[], client_id: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = this.clients.get(client_id)
      if (!client || client.websocket.readyState !== 1) {
        reject(new Error(`Browser not connected: ${client_id}`))
        return
      }
      client.pending_sql_resolve = resolve
      const message = new TextEncoder().encode(JSON.stringify({ type: 'sql', sql, params }))
      client.websocket.send(message)
    })
  }

  handle_browser_response(client_id: string, data: Uint8Array) {
    const client = this.clients.get(client_id)
    if (!client) return

    const json_str = new TextDecoder().decode(data)
    if (client.pending_sql_resolve) {
      client.pending_sql_resolve(json_str)
      client.pending_sql_resolve = null
    }
  }
}
