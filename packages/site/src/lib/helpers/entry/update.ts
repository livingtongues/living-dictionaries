import { update, updateOnline } from 'sveltefirets'
import { get } from 'svelte/store'
import type { ActualDatabaseEntry, GoalDatabaseEntry } from '@living-dictionaries/types'
import { page } from '$app/stores'

export async function updateEntry({
  data,
  entryId,
}: {
  data: GoalDatabaseEntry
  entryId: string
},
) {
  const { data: { t }, params: { dictionaryId } } = get(page)
  try {
    await update<GoalDatabaseEntry>(`dictionaries/${dictionaryId}/words/${entryId}`, data, { abbreviate: true })
  }
  catch (err) {
    alert(`${t('misc.error')}: ${err}`)
  }
}

export async function updateEntryOnline({
  data,
  entryId,
}: {
  data: GoalDatabaseEntry | ActualDatabaseEntry
  entryId: string
},
) {
  const { data: { t }, params: { dictionaryId } } = get(page)
  try {
    await updateOnline<GoalDatabaseEntry | ActualDatabaseEntry>(`dictionaries/${dictionaryId}/words/${entryId}`, data, { abbreviate: true })
  }
  catch (err) {
    alert(`${t('misc.error')}: ${err}`)
  }
}
