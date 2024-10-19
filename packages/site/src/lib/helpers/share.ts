import type { EntryView } from '@living-dictionaries/types'
import { get } from 'svelte/store'
import { page } from '$app/stores'

export async function share(dictionaryId: string, entry: EntryView) {
  const { data: { t } } = get(page)
  const title = `${dictionaryId} ${t('misc.LD_singular')}`
  const text = `${entry.main.lexeme.default}`
  const url = `https://livingdictionaries.app/${dictionaryId}/entry/${entry.id}`

  if (navigator.share) {
    await navigator.share({
      title,
      text,
      url,
    })
  } else {
    copy(`${text}, ${title}, ${url}`)
  }
}

function copy(message: string) {
  const { data: { t } } = get(page)

  try {
    navigator.clipboard.writeText(message)
    alert(t('entry.link_copied'))
  } catch {
    alert(`${t('entry.copy_and_share')} ${message}`)
  }
}
