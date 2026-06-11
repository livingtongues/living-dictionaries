/// <reference lib="webworker" />
/**
 * The leader dedicated worker entry. Spawned by whichever tab's main thread wins
 * the `navigator.locks` election for a dictionary (see `db-client.ts`). Owns the
 * dict's OPFS DB + sync engine, and serves RPC for EVERY tab over the transport.
 *
 * This worker does NOT run the election — its lifetime is tied to its spawning
 * tab (a dedicated worker dies with its document), and that tab holds the Web
 * Lock. When the tab closes, the worker dies and the lock frees, so another tab
 * is promoted and spawns its own leader worker.
 */
import type { DbInstance, WorkerInitMessage } from './instance'
import { create_transport_server } from './transport'
import type { TransportServer } from './transport'

let booted = false

self.onmessage = (event: MessageEvent<WorkerInitMessage>) => {
  if (booted) return
  booted = true
  void boot(event.data)
}

async function boot(init: WorkerInitMessage): Promise<void> {
  let instance: DbInstance | null = null

  const server: TransportServer = create_transport_server({
    channel_name: init.channel_name,
    on_request: (payload) => {
      if (!instance) {
        const err = new Error('leader DB not ready') as Error & { code: string }
        err.code = 'not_ready'
        throw err
      }
      return instance.handle(payload as Parameters<DbInstance['handle']>[0])
    },
    get_meta: () => instance?.meta() ?? { persistent: false, schema_version: '', has_editor_role: false },
  })

  try {
    const { create_dict_instance } = await import('../dict-instance')
    const factory = create_dict_instance(init.instance_options)
    instance = await factory({ emit_event: event => server.broadcast(event) })
    server.announce_ready()
  } catch (err) {
    console.error('[leader-worker] boot failed:', err)
    // Leave the server up so `get_meta`/errors are still answerable; clients will
    // surface the failure via timed-out / errored requests.
  }
}
