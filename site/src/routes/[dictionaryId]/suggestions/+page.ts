import type { PageLoad } from './$types'
import { guard_corpus_preview } from '$lib/corpus/corpus-preview-guard'

export const load: PageLoad = async ({ parent, params }) => {
  const { auth_user } = await parent()
  guard_corpus_preview({ auth_user, dictionary_url: params.dictionaryId })
}
