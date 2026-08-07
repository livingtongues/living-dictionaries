/**
 * Main-thread client for the leader-worker DB harness. Created in EVERY tab,
 * once per open dictionary.
 *
 * Responsibilities:
 *   1. Run the `navigator.locks` leader election for this dict. The winning tab
 *      spawns the one leader dedicated worker (which owns the dict's OPFS DB +
 *      sync engine).
 *   2. Expose a transport-backed RPC surface (`request`) + event subscription so
 *      this tab — leader or follower — talks to whoever is leader.
 *
 * Followers never spawn a worker; they reach the leader over the BroadcastChannel
 * transport. On a leader hand-off the transport re-sends outstanding requests, so
 * callers don't see the churn. `on_ready` re-fires on every hand-off — editor
 * tabs use it to re-assert `set_role` on a new leader that may have booted
 * viewer-mode (see `dict-session.ts`).
 */
import type { BootFailure, BootProgressDetail, DbEvent, DbRequest, InstanceOptions, LeaderMeta, WorkerInitMessage } from './instance'
// `?worker&url` (Vite) instead of the usual
// `new Worker(new URL('./leader-worker.ts', import.meta.url))`: it builds the
// same worker bundle but hands us the URL AS A STRING, which is the only way to
// know WHICH file the browser refused to load. A worker `error` event carries
// nothing else — verified in Chromium, the event is `{ type: 'error' }` and no
// message/filename — and without the URL the failure path had to GUESS, which is
// how 19 sessions were told their app was deleted over files that answered 200
// (2026-08-06 log review §1.4). The URL feeds one HEAD probe before we accuse.
import leader_worker_url from './leader-worker.ts?worker&url'
import { carry_poison_recovery_claim, db_channel_name, db_lock_name } from './instance'
import { start_leader_election } from './leader-election'
import type { LeaderElection } from './leader-election'
import type { BootFault } from './boot-recovery'
import { boot_retry_decision, read_boot_fault, reelect_delay } from './boot-recovery'
// LD-only policy (this file is 🔴 divergent in `PARITY.md`, so an app import is safe here).
import { boot_reelect_decision } from '../boot-give-up'
import { ensure_persistent_storage } from './persistent-storage'
import { create_transport_client } from './transport'
import type { TransportClient } from './transport'

export interface DbClient {
  request: <T>(payload: DbRequest, options?: { timeout_ms?: number }) => Promise<T>
  on_event: (handler: (event: DbEvent) => void) => () => void
  /** Fires on every leader `ready` (including hand-offs to a new leader). */
  on_ready: (handler: (meta: LeaderMeta) => void) => () => void
  /** Resolves with leader meta once any tab's leader worker is ready. */
  ready: () => Promise<LeaderMeta>
  /** Last-known leader meta (null before the first `ready`). */
  meta: () => LeaderMeta | null
  destroy: () => void
}

export function create_db_client({ instance_options, on_boot_failed, on_boot_progress, boot_failure_terminal_reason }: {
  instance_options: InstanceOptions
  /**
   * Fired on the main thread every time a spawned leader worker posts
   * `boot_failed` (a throw OR an idle-watchdog stall). The app wires this to
   * telemetry — worker-internal errors never reach `console.error` patching, so
   * this is the ONLY window into boot failures. Kept generic (no app imports).
   */
  on_boot_failed?: (info: BootFailure) => void
  /**
   * Fired as the spawned leader worker progresses through boot phases (per
   * `snapshot_fetch` download chunk it carries byte counts). Only THIS tab's
   * leader worker reports — followers reach a ready leader and never spawn one.
   * The app wires this to a boot download progress bar.
   */
  on_boot_progress?: (info: { stage: string, detail?: BootProgressDetail }) => void
  /**
   * Injected policy: given the EVIDENCE about a boot failure, is retrying
   * PROVABLY useless? Return a reason string if so, `null` to run the normal
   * ladder. Default: nothing is terminal.
   *
   * Async because the honest answer needs the network: the app's classifier
   * HEAD-probes `script_url` (or the URL named in `message`) before declaring a
   * build artifact deleted. `online` is passed because offline vetoes the whole
   * classification. Awaiting it costs at most the probe timeout, and only on a
   * boot that has already failed.
   *
   * This is a hook rather than a hard-coded rule so the harness stays app-agnostic
   * (it is copy-paste-shared with house — see its `$lib/db/worker/PARITY.md`). LD
   * passes the deleted-build-artifact classifier; see
   * `$lib/db/client/stale-build-artifact.ts` for the rule and the incident.
   */
  boot_failure_terminal_reason?: (info: { message: string, script_url: string | null, online: boolean }) => string | null | Promise<string | null>
}): DbClient {
  const { dict_id } = instance_options
  const channel_name = db_channel_name(dict_id)
  const lock_name = db_lock_name(dict_id)

  const transport: TransportClient = create_transport_client({ channel_name })

  let worker: Worker | null = null
  let last_meta: LeaderMeta | null = null
  // Bounded same-tab boot retry: a transient hang/throw self-heals in THIS tab
  // (so a single tab with no other waiter to promote isn't dead-ended), capped so
  // it can't spin. Reset whenever any leader announces ready.
  let boot_attempt = 0
  let boot_retry_timer: ReturnType<typeof setTimeout> | null = null
  // Slow background re-election after resign (auto-heal a lone dead-ended tab).
  let reelect_attempt = 0
  let reelect_timer: ReturnType<typeof setTimeout> | null = null
  // Synthetic wedge-harness fault (inert in prod — the window flag is never set).
  const boot_fault: BootFault | undefined = read_boot_fault()
  let fault_remaining = boot_fault?.count ?? 0

  transport.on_ready((meta) => {
    // A leader (this tab or another) is healthy — stop retrying + re-electing.
    last_meta = meta as LeaderMeta
    boot_attempt = 0
    reelect_attempt = 0
    if (reelect_timer) { clearTimeout(reelect_timer); reelect_timer = null }
  })

  // The claim is broadcast before the worker deletes the poisoned viewer file.
  // Mutating the retained init options carries the spent permit into every later
  // worker spawned by this tab; other open tabs receive the same broadcast and
  // do likewise before a leader hand-off.
  transport.on_event((event) => {
    carry_poison_recovery_claim({ options: instance_options, event: event as DbEvent })
  })

  const election: LeaderElection = start_leader_election({
    lock_name,
    on_promote: () => {
      spawn_leader_worker()
      // Origin-scoped silent request (never prompts viewers). Editors get the
      // prompting request in `dict-session.ts` once their role is known.
      void ensure_persistent_storage({ allow_prompt: false })
    },
  })

  function spawn_leader_worker(): void {
    if (worker) return
    const spawned = new Worker(leader_worker_url, {
      type: 'module',
      name: `ld-db-leader-${dict_id}`,
    })
    // Exactly ONE boot outcome per spawned worker. Both channels below can fire for
    // the same worker (its script loads, its import 404s, then it errors), and
    // handling either twice would double-count the ladder.
    let handled = false

    // A worker whose SCRIPT ITSELF cannot be fetched never posts anything — it
    // fires `error` on the Worker object. Unhandled (as it was), that was a SILENT
    // permanent wedge: no `boot_failed`, no `ready`, and the tab still holding the
    // lock.
    //
    // PROBE BEFORE YOU ACCUSE (2026-08-06 log review §1.4). This path used to
    // declare the artifact deleted BY CONSTRUCTION — "the URL is content-hashed,
    // so a load failure means it's gone". The immutable-asset archive made that
    // false: the previous builds' assets are served for 30 days, so the common
    // cause of this event is now a dropped connection. It cost 19 sessions a
    // bogus "this app was updated" (or a dead end) in one day over files that
    // answered 200. We now hand the classifier the evidence — the script URL and
    // `navigator.onLine` — and it settles the question with one HEAD request.
    spawned.onerror = (event) => {
      const message = (event as ErrorEvent)?.message || 'leader worker script failed to load'
      void handle_boot_failure({ message, script_url: leader_worker_url })
    }

    spawned.onmessage = (event: MessageEvent<{ type?: string, message?: string, last_stage?: string, stage?: string, detail?: BootProgressDetail }>) => {
      if (event.data?.type === 'boot_progress') {
        on_boot_progress?.({ stage: event.data.stage ?? '', detail: event.data.detail })
        return
      }
      if (event.data?.type !== 'boot_failed')
        return
      void handle_boot_failure({
        message: event.data.message ?? 'unknown',
        last_stage: event.data.last_stage,
        // A failure REPORTED BY the worker names its own culprit in the message
        // (or names none at all, Safari-style) — the worker script itself
        // clearly loaded, so blaming it here would probe the wrong file.
        script_url: null,
      })
    }

    // The worker posts `boot_failed` if it can't open the DB — a throw OR a
    // watchdog timeout on a HANGING factory (leader-worker.ts). It never announced
    // `ready`, so otherwise every tab's RPCs wedge as "no leader responded". Retry
    // our own boot a few times (covers a transient stall + self-heals a SINGLE tab
    // with no other waiter to promote); once the budget is spent, RESIGN so the
    // browser can promote another tab (or, if none, callers fall back). The one
    // exception is a `terminal_reason` — see below.
    async function handle_boot_failure({ message, last_stage, script_url }: { message: string, last_stage?: string, script_url: string | null }): Promise<void> {
      // Claim + tear down SYNCHRONOUSLY, before any await: both channels can fire
      // for the same worker, and a gap here would let the second one through.
      if (handled) return
      handled = true
      spawned.onerror = null
      spawned.terminate()
      if (worker === spawned) worker = null

      const online = typeof navigator === 'undefined' || navigator.onLine !== false
      const terminal_reason = (await boot_failure_terminal_reason?.({ message, script_url, online })) ?? null
      // THE RELOAD-ONCE RULE: when the artifact is gone from the server, no number
      // of retries can succeed — burning the ladder just costs the person minutes
      // (39 retries / 6 minutes for one signed-in editor, 2026-07-29). Report it as
      // terminal immediately and let the app reload onto the current build. We also
      // do NOT resign + re-elect: re-electing this tab would re-run the same
      // impossible import, and promoting another tab of the same stale bundle would
      // hand it the same impossibility.
      if (terminal_reason) {
        console.warn(`[db-client] leader worker boot failed on a missing build artifact — not retrying (${terminal_reason}):`, message)
        // Resign (but never re-acquire): this tab cannot boot a leader, so holding
        // the lock only wedges every other tab. A tab already on the CURRENT build
        // can take over immediately. Done BEFORE the callback because the app's
        // recovery is a synchronous `location.reload()`.
        election.resign()
        on_boot_failed?.({ message, last_stage, attempt: boot_attempt, will_retry: false, terminal_reason })
        return
      }
      const { will_retry, delay_ms } = boot_retry_decision({ attempt: boot_attempt })
      // THE CROSS-ELECTION BOUND (2026-08-03). `boot_retry_decision` bounds the
      // attempts INSIDE one worker; a re-election spawns a NEW worker whose ladder
      // starts at zero, so the pair was bounded × unbounded = unbounded — which is
      // how one iPhone visitor reached 17 boot-failure rows over 9.5 minutes with
      // nothing on screen but an indeterminate bar (§1.3, 2026-08-02). Once the
      // re-election budget is spent this tab stops and the app owns the visible
      // failure state. NOTE FOR house: its copy of this file has the same
      // unbounded shape and wants the same bound.
      const will_reelect = will_retry || boot_reelect_decision({ reelect_attempt }).will_reelect
      on_boot_failed?.({
        message,
        last_stage,
        attempt: boot_attempt,
        will_retry,
        will_reelect,
        reelect_attempt,
        terminal_reason: null,
      })
      if (will_retry) {
        console.warn(`[db-client] leader worker boot failed (attempt ${boot_attempt + 1}) — retrying in ${delay_ms}ms:`, message)
        boot_attempt++
        boot_retry_timer = setTimeout(() => { boot_retry_timer = null; spawn_leader_worker() }, delay_ms)
      } else if (!will_reelect) {
        // Give up: resign so a healthier tab can lead, but never re-acquire. The
        // person is now looking at the failure panel with a reset action instead of
        // a bar that never ends.
        console.warn(`[db-client] leader worker boot failed — re-election budget spent after ${reelect_attempt} cycles, giving up:`, message)
        boot_attempt = 0
        election.resign()
      } else {
        // Fast in-tab retries spent — resign so ANY other waiter can try, then
        // re-enter the election on a slow backoff. A lone tab (no other waiter)
        // used to dead-end here forever; now it self-heals once the transient
        // cause (deploy window, poor connection) clears. `on_ready` cancels this
        // the moment any tab becomes a healthy leader.
        const reelect_ms = reelect_delay({ attempt: reelect_attempt })
        console.warn(`[db-client] leader worker boot failed — retries exhausted, resigning + re-electing in ${reelect_ms}ms:`, message)
        boot_attempt = 0
        reelect_attempt++
        election.resign()
        if (reelect_timer) clearTimeout(reelect_timer)
        reelect_timer = setTimeout(() => { reelect_timer = null; election.reacquire() }, reelect_ms)
      }
    }
    worker = spawned
    const init: WorkerInitMessage = { channel_name, instance_options }
    // Inject the synthetic fault for the first N spawns, then let boot succeed.
    if (boot_fault && fault_remaining > 0) {
      init.boot_fault = boot_fault.mode
      init.boot_timeout_ms = boot_fault.timeout_ms
      fault_remaining--
    }
    spawned.postMessage(init)
  }

  return {
    request<T>(payload: DbRequest, options?: { timeout_ms?: number }): Promise<T> {
      return transport.request<T>(payload, options)
    },
    on_event(handler: (event: DbEvent) => void): () => void {
      return transport.on_event(event => handler(event as DbEvent))
    },
    on_ready(handler: (meta: LeaderMeta) => void): () => void {
      return transport.on_ready(meta => handler(meta as LeaderMeta))
    },
    ready(): Promise<LeaderMeta> {
      return transport.ready().then(meta => meta as LeaderMeta)
    },
    meta(): LeaderMeta | null {
      return last_meta
    },
    destroy(): void {
      if (boot_retry_timer) {
        clearTimeout(boot_retry_timer)
        boot_retry_timer = null
      }
      if (reelect_timer) {
        clearTimeout(reelect_timer)
        reelect_timer = null
      }
      election.resign()
      transport.destroy()
      worker?.terminate()
      worker = null
    },
  }
}
