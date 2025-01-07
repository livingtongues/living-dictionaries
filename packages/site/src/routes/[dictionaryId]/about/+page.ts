import { getDocument, setOnline } from 'sveltefirets'
import type { IAbout } from '@living-dictionaries/types'
import { invalidateAll } from '$app/navigation'

export async function load({ params: { dictionaryId }, parent }) {
  const path = `dictionaries/${dictionaryId}/info/about`

  async function update_about(updated: string) {
    const { t } = await parent()
    try {
      await setOnline<IAbout>(path, { about: updated })
      await invalidateAll()
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }

  try {
    const aboutDoc = await getDocument<IAbout>(path)
    return { update_about, about: aboutDoc?.about }
  } catch (err) {
    console.error(err)
    return { update_about, about: null }
  }
}
