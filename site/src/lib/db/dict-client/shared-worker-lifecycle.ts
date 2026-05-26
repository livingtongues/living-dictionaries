import type { AuthHeaders } from './rpc-types'
import type { DictConnection } from './dict-connection'
import { create_dict_connection } from './dict-connection'

/**
 * Main-thread lifecycle for the dict SharedWorker. Spawns the worker on
 * demand (once per tab; the SharedWorker itself is shared across tabs of
 * the same origin), holds the `MessagePort`, and routes `get_dict_connection`
 * calls through `create_dict_connection`.
 *
 * On `window.unload` / `pagehide` we send `bye` so the SharedWorker can
 * decrement refcounts and shut down idle dict instances. This is best-effort
 * — even without it, the worker shuts down when all ports disconnect.
 */

let shared_worker: SharedWorker | null = null
let shared_port: MessagePort | null = null

function spawn_worker(): SharedWorker {
  if (shared_worker)
    return shared_worker
  // Vite + SvelteKit recognizes this URL form and bundles the worker.
  shared_worker = new SharedWorker(
    new URL('./shared-worker.ts', import.meta.url),
    { type: 'module', name: 'living-dictionaries-dicts' },
  )
  shared_port = shared_worker.port
  shared_port.start?.()

  // Fire-and-forget bye on unload — gives the SharedWorker a chance to drop
  // refcounts. `pagehide` covers BFCache restore on iOS Safari, which fires
  // before `unload` does (and unload doesn't fire at all in modern Chrome).
  if (typeof addEventListener === 'function') {
    const send_bye = () => {
      try { shared_port?.postMessage({ type: 'bye', req_id: 0 }) } catch { /* port closing */ }
    }
    addEventListener('pagehide', send_bye, { once: false })
    addEventListener('beforeunload', send_bye, { once: false })
  }
  return shared_worker
}

export function shared_worker_port(): MessagePort {
  if (shared_port)
    return shared_port
  spawn_worker()
  return shared_port!
}

interface OpenDictOptions {
  dict_id: string
  has_editor_role: boolean
  auth: AuthHeaders
}

/**
 * Open a dict via the SharedWorker. Multiple opens on the same dict_id from
 * the same tab return new connection shims that share the underlying
 * wa-sqlite instance in the SharedWorker.
 */
export async function open_dict(options: OpenDictOptions): Promise<DictConnection> {
  const port = shared_worker_port()
  const { connection } = await create_dict_connection({
    port,
    dict_id: options.dict_id,
    has_editor_role: options.has_editor_role,
    auth: options.auth,
  })
  return connection
}

/** Test/dev hook — drop the singleton so the next call respawns the worker. */
export function _reset_for_tests() {
  try { shared_port?.close() } catch { /* ignore */ }
  shared_port = null
  shared_worker = null
}
