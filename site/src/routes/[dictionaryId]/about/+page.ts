import { invalidateAll } from '$app/navigation'
import { api_dictionaries_catalog } from '$api/dictionaries/[id]/catalog/_call'

export function load({ parent }) {
  async function update_about(updated: string) {
    const { t, dictionary } = await parent()
    const { error } = await api_dictionaries_catalog(dictionary.id, { about: updated })
    if (error) {
      console.error(error)
      alert(`${t('misc.error')}: ${error.message}`)
      return
    }
    await invalidateAll()
  }

  return { update_about }
}
