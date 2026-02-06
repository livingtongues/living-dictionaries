import type { PGlite } from '@electric-sql/pglite'

const PROXY_WS_URL = 'ws://localhost:4000'

export type LiveShareStatus = 'disconnected' | 'connecting' | 'connected'

class LiveShareState {
  status = $state<LiveShareStatus>('disconnected')
  error = $state<string | null>(null)
  private websocket: WebSocket | null = null
  private pg: PGlite | null = null

  start({ pg, client_id }: { pg: PGlite, client_id: string }) {
    if (this.status !== 'disconnected') {
      console.info('Live share already active')
      return
    }

    this.pg = pg
    this.status = 'connecting'
    this.error = null

    try {
      const ws_url = `${PROXY_WS_URL}?client_id=${encodeURIComponent(client_id)}`
      console.info(`Live Share: Attempting to connect to ${ws_url}`)
      this.websocket = new WebSocket(ws_url)
      this.websocket.binaryType = 'arraybuffer'

      this.websocket.onopen = () => {
        console.info(`Live Share: Connected as ${client_id}`)
        this.status = 'connected'
      }

      this.websocket.onmessage = async (event) => {
        console.info('Live Share: Received message', event.data)
        if (!this.pg) return
        await this.handle_message(event)
      }

      this.websocket.onclose = (event) => {
        console.info(`Live Share: Disconnected from proxy (code: ${event.code}, reason: ${event.reason})`)
        this.status = 'disconnected'
        this.websocket = null
      }

      this.websocket.onerror = (event) => {
        console.error('Live Share: WebSocket error', event)
        this.error = 'Proxy not running'
        this.status = 'disconnected'
      }
    } catch (error) {
      console.error('Live Share: Failed to connect:', error)
      this.error = error instanceof Error ? error.message : 'Unknown error'
      this.status = 'disconnected'
    }
  }

  private async handle_message(event: MessageEvent) {
    const data = new Uint8Array(event.data as ArrayBuffer)
    const [message_type] = data

    try {
      if (message_type === 0x01) {
        // SQL query message
        const json_str = new TextDecoder().decode(data.slice(1))
        const { sql, params } = JSON.parse(json_str)

        const result = await this.pg!.query(sql, params)
        const response_json = JSON.stringify({
          success: true,
          rows: result.rows,
          fields: result.fields,
          rowCount: result.rows.length,
        })
        const response_bytes = new TextEncoder().encode(response_json)
        const typed_response = new Uint8Array(response_bytes.length + 1)
        typed_response[0] = 0x02 // SQL response type

        typed_response.set(response_bytes, 1)
        this.websocket?.send(typed_response)
      } else {
        // Wire protocol message (existing behavior)
        const response = await this.pg!.execProtocolRaw(data)
        this.websocket?.send(response)
      }
    } catch (error) {
      console.error('Live Share: Error executing:', error)
      if (message_type === 0x01) {
        const error_response = JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        const response_bytes = new TextEncoder().encode(error_response)
        const typed_response = new Uint8Array(response_bytes.length + 1)
        typed_response[0] = 0x02
        typed_response.set(response_bytes, 1)
        this.websocket?.send(typed_response)
      }
    }
  }

  stop() {
    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
    }
    this.pg = null
    this.status = 'disconnected'
    this.error = null
    console.info('Live Share: Stopped')
  }
}

export const live_share = new LiveShareState()
