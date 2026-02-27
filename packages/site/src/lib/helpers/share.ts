import type { EntryData } from '@living-dictionaries/types'
import { page } from '$app/state'

export async function share(dictionaryId: string, entry: EntryData) {
  const title = `${dictionaryId} ${page.data.t('misc.LD_singular')}`
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
  try {
    navigator.clipboard.writeText(message)
    alert(page.data.t('entry.link_copied'))
  } catch {
    alert(`${page.data.t('entry.copy_and_share')} ${message}`)
  }
}
