import { getDocument, setOnline } from 'sveltefirets'
import type { IAbout, IGrammar } from '@living-dictionaries/types'
import { invalidateAll } from '$app/navigation'

export async function load({ params: { dictionaryId }, parent }) {
  async function update_about(updated: string) {
    const { t } = await parent()
    try {
      await setOnline<IGrammar>(`dictionaries/${dictionaryId}/info/grammar`, { grammar: updated })
      await invalidateAll()
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }

  try {
    const aboutDoc = await getDocument<IAbout>(`dictionaries/${dictionaryId}/info/about`)
    return { update_about, about: aboutDoc?.about }
  } catch (err) {
    console.error(err)
    return { update_about, about: null }
  }
}
