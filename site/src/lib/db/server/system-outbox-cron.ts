/**
 * Fast drain of the `chat_system_outbox` queue. Jacob's agent enqueues a row
 * (see the `/system-chat` command); this cron delivers it inside the runtime —
 * posting as the System bot + firing the normal member ping. Short interval so an
 * agent-authored message lands promptly. Gated like the other crons: dormant in
 * dev/build, IS_STANDBY-gated (primary only), singleton.
 */
import { building, dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import { process_system_outbox } from '$lib/server/chat/system-outbox'
import { log_server_event } from '$lib/server/log-server-event'
import { get_shared_db } from './shared-db'

const SWEEP_INTERVAL_MS = 20 * 1000 // 20s — snappy delivery for on-demand posts
const SITE_URL = env.ORIGIN || 'https://new.livingdictionaries.app'

const SINGLETON_KEY = Symbol.for('ld.system-outbox-cron.state')
interface CronState { interval: ReturnType<typeof setInterval>, in_flight: boolean }
interface GlobalWithCron { [SINGLETON_KEY]?: CronState }

export function start_system_outbox_cron_once(): void {
  if (building || dev)
    return
  if (env.IS_STANDBY === 'true') {
    console.info('[system-outbox] IS_STANDBY — cron disabled on standby container.')
    return
  }
  const slot = globalThis as unknown as GlobalWithCron
  if (slot[SINGLETON_KEY]) {
    console.info('[system-outbox] Already running — skip.')
    return
  }
  const state: CronState = {
    interval: setInterval(() => run_guarded(state), SWEEP_INTERVAL_MS),
    in_flight: false,
  }
  slot[SINGLETON_KEY] = state
  console.info(`[system-outbox] Started — draining every ${SWEEP_INTERVAL_MS / 1000}s.`)
}

export function stop_system_outbox_cron(): void {
  const slot = globalThis as unknown as GlobalWithCron
  const state = slot[SINGLETON_KEY]
  if (!state)
    return
  clearInterval(state.interval)
  delete slot[SINGLETON_KEY]
}

function run_guarded(state: CronState): void {
  if (state.in_flight)
    return
  state.in_flight = true
  void process_system_outbox({ db: get_shared_db(), base_url: SITE_URL })
    .then((delivered) => { if (delivered > 0) console.info(`[system-outbox] delivered ${delivered} System message(s).`) })
    .catch((err) => {
      console.error('[system-outbox] sweep failed:', err)
      log_server_event({ level: 'error', message: 'system_outbox_sweep_failed', error: err })
    })
    .finally(() => { state.in_flight = false })
}
