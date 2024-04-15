import { getDocument, setOnline } from 'sveltefirets'
import type { IGrammar } from '@living-dictionaries/types'
import { invalidateAll } from '$app/navigation'

export async function load({ params: { dictionaryId }, parent }) {
  async function update_grammar(updated: string) {
    const { t } = await parent()
    try {
      await setOnline<IGrammar>(`dictionaries/${dictionaryId}/info/grammar`, { grammar: updated })
      await invalidateAll()
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }

  try {
    const grammarDoc = await getDocument<IGrammar>(`dictionaries/${dictionaryId}/info/grammar`)
    return { update_grammar, grammar: grammarDoc?.grammar }
  } catch (err) {
    console.error(err)
    return { update_grammar, grammar: null }
  }
}
