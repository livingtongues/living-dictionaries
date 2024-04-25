import { getDocument, setOnline } from 'sveltefirets'
import type { IGrammar } from '@living-dictionaries/types'
import { invalidateAll } from '$app/navigation'

export async function load({ params: { dictionaryId }, parent }) {
  const path = `dictionaries/${dictionaryId}/info/grammar`

  async function update_grammar(updated: string) {
    const { t } = await parent()
    try {
      await setOnline<IGrammar>(path, { grammar: updated })
      await invalidateAll()
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }

  try {
    const grammarDoc = await getDocument<IGrammar>(path)
    return { update_grammar, grammar: grammarDoc?.grammar }
  } catch (err) {
    console.error(err)
    return { update_grammar, grammar: null }
  }
}
