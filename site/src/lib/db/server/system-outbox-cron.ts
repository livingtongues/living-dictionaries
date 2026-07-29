/**
 * Fast drain of the `chat_system_outbox` queue. Jacob's agent enqueues a row
 * (see the `/system-chat` command); this cron delivers it inside the runtime —
 * posting as the System bot + firing the normal member ping. Short interval so an
 * agent-authored message lands promptly. Gated like the other crons: dormant in
 * dev/build, IS_STANDBY-gated (primary only), singleton.
 */
import { env } from '$env/dynamic/private'
import { process_system_outbox } from '$lib/server/chat/system-outbox'
import { log_server_event } from '$lib/server/log-server-event'
import { get_shared_db } from './shared-db'

const SITE_URL = env.ORIGIN || 'https://new.livingdictionaries.app'

/** The roster's `run`: one drain with its queryable failure event. */
export async function run_system_outbox_sweep(): Promise<void> {
  try {
    const delivered = await process_system_outbox({ db: get_shared_db(), base_url: SITE_URL })
    if (delivered > 0)
      console.info(`[system-outbox] delivered ${delivered} System message(s).`)
  } catch (err) {
    console.error('[system-outbox] sweep failed:', err)
    log_server_event({ level: 'error', message: 'system_outbox_sweep_failed', error: err })
  }
}
