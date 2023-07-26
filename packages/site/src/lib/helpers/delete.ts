import { t } from 'svelte-i18n';
import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import type { GoalDatabaseVideo, IEntry } from '@living-dictionaries/types';
import { updateOnline, deleteDocumentOnline, set } from 'sveltefirets';
import { arrayUnion } from 'firebase/firestore/lite';
import { serverTimestamp } from 'firebase/firestore';

export async function deleteImage(entry: IEntry, dictionaryId: string) {
  const $t = get(t);
  try {
    await updateOnline<IEntry>(
      `dictionaries/${dictionaryId}/words/${entry.id}`,
      { pf: null },
      { abbreviate: true }
    );
  } catch (err) {
    alert(`${$t('misc.error', { default: 'Error' })}: ${err}`);
  }
}

export async function deleteAudio(entry: IEntry, dictionaryId: string) {
  const $t = get(t);
  try {
    await updateOnline<IEntry>(
      `dictionaries/${dictionaryId}/words/${entry.id}`,
      { sf: null, sfs: null },
      { abbreviate: true }
    );
  } catch (err) {
    alert(`${$t('misc.error', { default: 'Error' })}: ${err}`);
  }
}

export async function deleteVideo(entry: IEntry, dictionaryId: string) {
  const $t = get(t);
  try {
    const video = entry.vfs[0];
    const deletedVideo: GoalDatabaseVideo = {
      ...video,
      sp: Array.isArray(video.sp) ? video.sp : [video.sp],
      deleted: Date.now(),
    };
    await updateOnline<IEntry>(
      `dictionaries/${dictionaryId}/words/${entry.id}`,
      { vfs: null, deletedVfs: arrayUnion(deletedVideo) },
      { abbreviate: true }
    );
  } catch (err) {
    alert(`${$t('misc.error', { default: 'Error' })}: ${err}`);
  }
}

export async function deleteEntry(entry: IEntry, dictionaryId: string, algoliaQueryParams: string) {
  const $t = get(t);
  if (
    confirm(
      $t('entry.delete_entry', {
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
      alert(`${$t('misc.error', { default: 'Error' })}: ${err}`);
    }
  }
}
