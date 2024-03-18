import type { GoalDatabaseVideo, ActualDatabaseEntry } from '@living-dictionaries/types';
import { update } from 'sveltefirets';
import { get } from 'svelte/store';
import { arrayUnion } from 'firebase/firestore';
import { page } from '$app/stores';

export async function addVideo(entry_id: string, video: GoalDatabaseVideo) {
  const { data: { t, dictionary } } = get(page)
  try {
    video.ts = Date.now();
    await update<ActualDatabaseEntry>(
      `dictionaries/${dictionary.id}/words/${entry_id}`,
      { vfs: arrayUnion(video) },
      { abbreviate: true }
    );
  } catch (err) {
    alert(`${t('misc.error')}: ${err}`);
  }
}
