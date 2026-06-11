import { invalidate } from '$app/navigation'
import { api_dictionaries_catalog } from '$api/dictionaries/[id]/catalog/_call'
import { DICTIONARY_UPDATED_LOAD_TRIGGER } from '$lib/dbOperations'

export function load({ parent }) {
  async function update_about(updated: string) {
    const { t, dictionary } = await parent()
    const { error } = await api_dictionaries_catalog(dictionary.id, { about: updated })
    if (error) {
      console.error(error)
      alert(`${t('misc.error')}: ${error.message}`)
      return
    }
    // Scoped to the dict subtree — re-runs +layout.ts (which depends on this
    // trigger) and, via its `await parent()`, the +layout.server.ts catalog
    // read. Avoids invalidateAll's root re-run + global list refetches.
    await invalidate(DICTIONARY_UPDATED_LOAD_TRIGGER)
  }

  return { update_about }
}
