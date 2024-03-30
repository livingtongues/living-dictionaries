import { get } from 'svelte/store';
import { page } from '$app/stores';
import type { ActualDatabaseEntry } from '@living-dictionaries/types';
import { addOnline } from 'sveltefirets';
import { goto } from '$app/navigation';

export async function addNewEntry(lexeme: string) {
  const { data: { t }, params: { dictionaryId } } = get(page)

  if (!lexeme)
    return alert(`Missing: ${t('entry_field.lexeme')}`);

  try {
    const entryDoc = await addOnline<ActualDatabaseEntry>(
      `dictionaries/${dictionaryId}/words`,
      {
        lx: lexeme,
        gl: {},
      },
      { abbreviate: true }
    );
    goto(`/${dictionaryId}/entry/${entryDoc.id}`);
  } catch (err) {
    console.error(err);
    alert(`${t('misc.error')}: ${err}`);
  }
}
