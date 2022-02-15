import { dictionary } from '$lib/stores';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import type { IEntry } from '$lib/interfaces';
import { updateOnline, deleteDocumentOnline, setOnline } from '$sveltefirets';
import { serverTimestamp } from 'firebase/firestore/lite';

export async function deleteImage(entry: IEntry) {
  const $_ = get(_);
  try {
    const $dictionary = get(dictionary);
    await updateOnline(
      `dictionaries/${$dictionary.id}/words/${entry.id}`,
      { pf: null },
      { abbreviate: true }
    );
  } catch (err) {
    alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
  }
}

export async function deleteAudio(entry: IEntry) {
  const $_ = get(_);
  try {
    const $dictionary = get(dictionary);
    await updateOnline(
      `dictionaries/${$dictionary.id}/words/${entry.id}`,
      { sf: null },
      { abbreviate: true }
    );
  } catch (err) {
    alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
  }
}

export async function deleteVideo(entry: IEntry) {
  const $_ = get(_);
  try {
    const $dictionary = get(dictionary);
    await updateOnline(
      `dictionaries/${$dictionary.id}/words/${entry.id}`,
      { vf: null },
      { abbreviate: true }
    );
  } catch (err) {
    alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
  }
}

import { goto } from '$app/navigation';
export async function deleteEntry(entry: IEntry, dictionaryId: string, algoliaQueryParams: string) {
  const $_ = get(_);
  if (
    confirm(
      $_('entry.delete_entry', {
        default: 'Delete entry?',
      })
    )
  ) {
    try {
      goto(`/${dictionaryId}/entries/list${algoliaQueryParams}`);
      const timeStampRemovedEntry = { ...entry };
      delete timeStampRemovedEntry.ca; // needed b/c error when entry is received by firestore and set by firestore/lite
      delete timeStampRemovedEntry.ua;
      await setOnline<IEntry>(`dictionaries/${dictionaryId}/deletedEntries/${entry.id}`, {
        ...timeStampRemovedEntry,
        // @ts-ignore
        deletedAt: serverTimestamp(),
      });
      await deleteDocumentOnline(`dictionaries/${dictionaryId}/words/${entry.id}`);
    } catch (err) {
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
  }
}
