import { get_shared_db } from '$lib/db/server/shared-db'
import { log_server_event } from '$lib/server/log-server-event'
import { seed_translations_if_empty, sync_en_catalog } from './i18n-db'

/**
 * Boot step (hooks.server.ts): mirror the code's English catalog into
 * `i18n_keys` — so a key an agent adds in code appears in /translate on the
 * next deploy — then, on a virgin DB only, seed `i18n_translations` from the
 * committed locale files (the final Google-Sheet snapshot). Idempotent and
 * blue/green-safe; failures are logged, never boot-fatal.
 */
export function boot_i18n_catalog(): void {
  void (async () => {
    try {
      const db = get_shared_db()
      const result = sync_en_catalog({ db })
      const seeded = await seed_translations_if_empty({ db })
      if (seeded || result.added || result.changed || result.removed || result.restored)
        log_server_event({ level: 'info', message: 'i18n catalog synced', context: { ...result, seeded } })
    } catch (error) {
      log_server_event({ level: 'error', message: 'i18n catalog boot sync failed', error })
    }
  })()
}
