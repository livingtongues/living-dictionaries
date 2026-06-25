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
import { apply_boot_fault, BOOT_TIMEOUT_MS, with_boot_timeout } from './boot-recovery'

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
    // Watchdog: a factory that HANGS (never resolves) — a slow/locked OPFS handle
    // — would otherwise wedge the origin forever (never `ready`, never
    // `boot_failed`). Time the open out so the catch posts `boot_failed` and the
    // spawning tab can retry / resign. The synthetic `boot_fault` (no-op in prod)
    // runs INSIDE the timed region so a `hang` exercises the watchdog like a real
    // stuck factory.
    const open = apply_boot_fault(init.boot_fault).then(() => factory({ emit_event: event => server.broadcast(event) }))
    instance = await with_boot_timeout(open, init.boot_timeout_ms ?? BOOT_TIMEOUT_MS)
    server.announce_ready()
  } catch (err) {
    console.error('[leader-worker] boot failed:', err)
    // We never announced `ready`, so no tab can see this leader — yet the tab that
    // spawned us still holds the `navigator.locks` lock for its lifetime. If we
    // just sat here, that lock is never freed, so NO other tab can be promoted to
    // retry, and every tab's RPCs time out forever as "no leader responded" (a
    // permanent origin-wide wedge). Tear down our channel and tell the spawning
    // tab to retry/resign so a fresh leader can boot (or callers fall back).
    server.destroy()
    self.postMessage({ type: 'boot_failed', message: (err as Error)?.message ?? 'unknown' })
  }
}
