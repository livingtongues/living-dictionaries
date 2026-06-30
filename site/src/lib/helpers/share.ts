import type { EntryData } from '$lib/types'
import { page } from '$app/state'

export async function share(dictionaryId: string, entry: EntryData) {
  const { data: { t } } = page
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
  const { data: { t } } = page

  try {
    navigator.clipboard.writeText(message)
    alert(t('entry.link_copied'))
  } catch {
    alert(`${t('entry.copy_and_share')} ${message}`)
  }
}
