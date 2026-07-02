import type { AuthHeaders } from './worker/instance'
import type { DbClient } from './worker/db-client'
import type { DictConnection } from './worker-connection'
import { create_db_client } from './worker/db-client'
import { ensure_persistent_storage } from './worker/persistent-storage'
import { create_dict_worker_connection } from './worker-connection'
import { end_dict_boot_progress, report_dict_boot_progress } from './dict-boot-progress.svelte'
import { log_event } from '$lib/debug/remote-log'

/**
 * Main-thread lifecycle for the per-dict leader-worker DB. `open_dict` runs the
 * leader election for that dict (one `DbClient` per dict per tab — the winner
 * spawns the leader dedicated worker; followers RPC it over BroadcastChannel),
 * waits for a leader to be ready, and returns the `DictConnection` shim.
 *
 * Clients are cached per dict_id on globalThis for the tab's lifetime (mirrors
 * the `+layout.ts` connection cache). No unload teardown is needed: a dedicated
 * worker dies with its document and Web Locks auto-release, so leadership hands
 * off to another tab by itself.
 *
 * Editor tabs assert `set_role` after EVERY leader `ready` — the current leader
 * may have booted viewer-mode (pull-only), and a hand-off can promote a fresh
 * viewer-booted leader mid-session.
 */

interface DictClientGlobals {
  __ld_dict_clients?: Record<string, { client: DbClient, has_editor_role: boolean, auth: AuthHeaders }>
}

interface OpenDictOptions {
  dict_id: string
  has_editor_role: boolean
  auth: AuthHeaders
}

export async function open_dict(options: OpenDictOptions): Promise<DictConnection> {
  const { dict_id } = options
  const globals = globalThis as DictClientGlobals
  globals.__ld_dict_clients ??= {}

  // An editor has precious unsynced local writes — request persistent storage so
  // the browser won't evict them (a one-time Firefox prompt is justified).
  // Idempotent + origin-scoped; a no-op once granted. Viewers stay on the silent
  // path in `db-client.ts` and never see a prompt.
  if (options.has_editor_role)
    void ensure_persistent_storage({ allow_prompt: true })

  let cached = globals.__ld_dict_clients[dict_id]
  if (!cached) {
    const client = create_db_client({
      instance_options: { dict_id, has_editor_role: options.has_editor_role, auth: options.auth },
      // Worker-internal boot failures never reach the main-thread console.error
      // patch, so this is our only telemetry window. `last_stage` points the stall
      // at the exact boot phase (a slow `snapshot_fetch` vs a stuck `opfs_open`).
      on_boot_failed: ({ message, last_stage, attempt, will_retry }) => {
        log_event({
          level: will_retry ? 'warn' : 'error',
          message: 'leader_boot_failed',
          context: { dict_id, boot_message: message, last_stage, attempt, will_retry },
        })
      },
      // Feed the boot download progress bar (root-layout `DictBootProgress`). Only
      // a cold boot that actually downloads a snapshot activates it (see the store).
      on_boot_progress: ({ stage, detail }) => report_dict_boot_progress({ dict_id, stage, detail }),
    })
    cached = { client, has_editor_role: options.has_editor_role, auth: options.auth }
    globals.__ld_dict_clients[dict_id] = cached

    const entry = cached
    client.on_ready(() => {
      // Re-assert the editor capability on every leader (covers hand-offs to a
      // viewer-booted leader). Idempotent on the instance side.
      if (entry.has_editor_role)
        void client.request({ type: 'set_role', has_editor_role: true, auth: entry.auth }).catch(() => { /* retried on next ready */ })
    })
  } else if (options.has_editor_role && !cached.has_editor_role) {
    // A later open from this tab carries the editor capability — promote.
    cached.has_editor_role = true
    cached.auth = options.auth
    void cached.client.request({ type: 'set_role', has_editor_role: true, auth: options.auth }).catch(() => { /* retried on next ready */ })
  }

  await cached.client.ready()
  // Leader is ready — the snapshot is in OPFS and open, so drop the boot bar.
  end_dict_boot_progress(dict_id)
  if (cached.has_editor_role)
    await cached.client.request({ type: 'set_role', has_editor_role: true, auth: cached.auth })

  return create_dict_worker_connection({ client: cached.client, dict_id })
}

/** Test/dev hook — drop the cached clients so the next call re-elects. */
export function _reset_for_tests() {
  const globals = globalThis as DictClientGlobals
  for (const { client } of Object.values(globals.__ld_dict_clients ?? {}))
    client.destroy()
  globals.__ld_dict_clients = undefined
}
