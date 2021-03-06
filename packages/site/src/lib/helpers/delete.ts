import { dictionary } from '$lib/stores';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import type { IEntry, IVideo } from '@living-dictionaries/types';
import { updateOnline, deleteDocumentOnline, set } from 'sveltefirets';
import { arrayUnion, arrayRemove } from 'firebase/firestore/lite';
import { serverTimestamp } from 'firebase/firestore';

export async function deleteImage(entry: IEntry) {
  const $_ = get(_);
  try {
    const $dictionary = get(dictionary);
    await updateOnline<IEntry>(
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
    await updateOnline<IEntry>(
      `dictionaries/${$dictionary.id}/words/${entry.id}`,
      { sf: null },
      { abbreviate: true }
    );
  } catch (err) {
    alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
  }
}

export async function deleteVideo(entry: IEntry, video: IVideo) {
  const $_ = get(_);
  try {
    const $dictionary = get(dictionary);
    const deletedVideo: IVideo = {
      ...video,
      deleted: Date.now(),
    };
    await updateOnline<IEntry>(
      `dictionaries/${$dictionary.id}/words/${entry.id}`,
      { vfs: arrayRemove(video), deletedVfs: arrayUnion(deletedVideo) },
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
      set<IEntry>(`dictionaries/${dictionaryId}/deletedEntries/${entry.id}`, {
        ...entry,
        deletedAt: serverTimestamp(),
      }); // using cache based set to avoid conflicts w/ serverTimestamps loaded in from firestore normal and sent out via firestore lite, not awaiting in case internet is flaky - can go on to the delete operation.
      await deleteDocumentOnline(`dictionaries/${dictionaryId}/words/${entry.id}`);
    } catch (err) {
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
  }
}
