import type { SqliteConnection } from './connection'
import { extract_table_name } from '$lib/db/dict-client/worker-connection'

/**
 * Browser-side counterpart to `site/sqlite-proxy/`. Connects to the dev proxy's
 * WebSocket (only in dev, only when an admin/editor/viewer has opened a local
 * DB), then answers SQL messages by running them against the local wa-sqlite
 * connection and shipping rows back as JSON.
 *
 * Multi-target: one browser tab can hold several DBs at once — the admin
 * shared.db plus any number of per-dict dict.db's. Each is registered under a
 * distinct `client_id` and gets its own WebSocket:
 *   - admin shared.db  → `<email>`
 *   - a dict's dict.db → `<email>::dict::<dict_id>`
 * The CLI's `--dict <id>` flag (see `scripts/sqlite-query.sh`) selects which.
 *
 * Write-aware: a write statement (INSERT/UPDATE/DELETE — detected via
 * `extract_table_name`) runs through `connection.execute()` rather than
 * `.query()`. For a `DictConnection` that fires the leader worker's
 * `tables_changed` broadcast so open tabs live-update. Main-thread connections
 * (the admin shared.db) don't broadcast, so an optional `notify(table)` callback
 * (= `live_db.notify_table`) refreshes that tab's reactive stores.
 *
 * Must mirror `sqlite-proxy/vite-plugin.ts` port math (BASE_VITE_PORT 3041).
 */
const BASE_VITE_PORT = 3041
const BASE_WS_PORT = 4050

function get_proxy_ws_url() {
  const vite_port = Number(location.port) || BASE_VITE_PORT
  const ws_port = BASE_WS_PORT + (vite_port - BASE_VITE_PORT) * 2
  return `ws://localhost:${ws_port}`
}

export type LiveShareStatus = 'disconnected' | 'connecting' | 'connected'

interface Target {
  websocket: WebSocket | null
  connection: SqliteConnection
  notify?: (table: string) => void
  status: LiveShareStatus
}

interface RegisterOptions {
  connection: SqliteConnection
  /** `<email>` for the admin shared.db, `<email>::dict::<dict_id>` for a dict.db. */
  client_id: string
  /** Refreshes reactive stores after a write on non-broadcasting connections. */
  notify?: (table: string) => void
}

class LiveShareState {
  private targets = new Map<string, Target>()

  register({ connection, client_id, notify }: RegisterOptions) {
    const existing = this.targets.get(client_id)
    if (existing && existing.status !== 'disconnected')
      return

    const target: Target = { websocket: null, connection, notify, status: 'connecting' }
    this.targets.set(client_id, target)

    try {
      const ws_url = `${get_proxy_ws_url()}?client_id=${encodeURIComponent(client_id)}`
      const websocket = new WebSocket(ws_url)
      websocket.binaryType = 'arraybuffer'
      target.websocket = websocket

      websocket.onopen = () => {
        console.info(`Live Share: connected as ${client_id}`)
        target.status = 'connected'
      }

      websocket.onmessage = async (event) => {
        await this.handle_message(target, event)
      }

      websocket.onclose = () => {
        console.info(`Live Share: disconnected ${client_id}`)
        target.status = 'disconnected'
        target.websocket = null
      }

      websocket.onerror = () => {
        target.status = 'disconnected'
      }
    } catch (err) {
      console.error('Live Share: failed to connect:', err)
      target.status = 'disconnected'
    }
  }

  unregister(client_id: string) {
    const target = this.targets.get(client_id)
    if (target?.websocket)
      target.websocket.close()
    this.targets.delete(client_id)
  }

  private async handle_message(target: Target, event: MessageEvent) {
    const data = new Uint8Array(event.data as ArrayBuffer)

    try {
      const { sql, params } = JSON.parse(new TextDecoder().decode(data))
      const write_table = extract_table_name(sql)

      if (write_table) {
        await target.connection.execute(sql, params)
        target.notify?.(write_table)
        target.websocket?.send(new TextEncoder().encode(JSON.stringify({
          success: true,
          rows: [],
          fields: [],
          rowCount: 0,
        })))
        return
      }

      const rows = await target.connection.query<Record<string, unknown>>(sql, params)
      target.websocket?.send(new TextEncoder().encode(JSON.stringify({
        success: true,
        rows,
        fields: rows.length > 0 ? Object.keys(rows[0]).map(name => ({ name })) : [],
        rowCount: rows.length,
      })))
    } catch (err) {
      console.error('Live Share: error executing:', err)
      target.websocket?.send(new TextEncoder().encode(JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      })))
    }
  }
}

export const live_share = new LiveShareState()
