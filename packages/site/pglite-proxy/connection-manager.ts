import type { PostgresConnection } from 'pg-gateway'
import type { WebSocket } from 'ws'

interface ClientConnection {
  websocket: WebSocket
  connected_at: Date
  pending_response_resolve: ((data: Uint8Array) => void) | null
  pending_sql_resolve: ((data: string) => void) | null
}

export class ConnectionManager {
  private clients = new Map<string, ClientConnection>()
  private connection: PostgresConnection | null = null
  private default_client_id: string | null = null

  set_websocket(client_id: string, ws: WebSocket) {
    const existing = this.clients.get(client_id)
    if (existing) {
      console.log(`[pglite-proxy] Replacing existing WebSocket for client: ${client_id}`)
      existing.websocket.close()
    }
    this.clients.set(client_id, {
      websocket: ws,
      connected_at: new Date(),
      pending_response_resolve: null,
      pending_sql_resolve: null,
    })
    if (!this.default_client_id) {
      this.default_client_id = client_id
    }
    console.log(`[pglite-proxy] Browser connected: ${client_id}`)
  }

  remove_websocket(client_id: string) {
    this.clients.delete(client_id)
    if (this.default_client_id === client_id) {
      this.default_client_id = this.clients.keys().next().value ?? null
    }
    console.log(`[pglite-proxy] Browser disconnected: ${client_id}`)
  }

  set_connection(conn: PostgresConnection) {
    this.connection = conn
  }

  remove_connection() {
    this.connection = null
    console.log('[pglite-proxy] Postgres client disconnected')
  }

  get_clients(): { id: string, connected_at: Date }[] {
    return Array.from(this.clients.entries()).map(([id, conn]) => ({
      id,
      connected_at: conn.connected_at,
    }))
  }

  has_browser(client_id?: string): boolean {
    const id = client_id ?? this.default_client_id
    if (!id) return false
    const client = this.clients.get(id)
    return client !== undefined && client.websocket.readyState === 1
  }

  has_connection(): boolean {
    return this.connection !== null
  }

  send_to_browser(data: Uint8Array, client_id?: string): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const id = client_id ?? this.default_client_id
      if (!id) {
        reject(new Error('No browser connected'))
        return
      }
      const client = this.clients.get(id)
      if (!client || client.websocket.readyState !== 1) {
        reject(new Error(`Browser not connected: ${id}`))
        return
      }
      client.pending_response_resolve = resolve
      client.websocket.send(data)
    })
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
      const typed_message = new Uint8Array(message.length + 1)
      typed_message[0] = 0x01 // SQL message type
      typed_message.set(message, 1)
      client.websocket.send(typed_message)
    })
  }

  handle_browser_response(client_id: string, data: Uint8Array) {
    const client = this.clients.get(client_id)
    if (!client) return

    const [message_type] = data

    if (message_type === 0x02) {
      // SQL response
      const json_str = new TextDecoder().decode(data.slice(1))
      if (client.pending_sql_resolve) {
        client.pending_sql_resolve(json_str)
        client.pending_sql_resolve = null
      }
    } else {
      // Wire protocol response (existing behavior)
      if (client.pending_response_resolve) {
        client.pending_response_resolve(data)
        client.pending_response_resolve = null
      } else if (this.connection?.streamWriter) {
        this.connection.streamWriter.write(data)
      }
    }
  }

  write_to_client(data: Uint8Array) {
    this.connection?.streamWriter?.write(data)
  }
}
