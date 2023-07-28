import type { IEntry, GoalDatabaseVideo } from '@living-dictionaries/types';
import { update } from 'sveltefirets';
import { get } from 'svelte/store';
import { dictionary } from '$lib/stores';
import { arrayUnion } from 'firebase/firestore';
import { _ } from 'svelte-i18n';

export async function addVideo(entry_id: string, video: GoalDatabaseVideo) {
  const $_ = get(_);
  try {
    const $dictionary = get(dictionary);
    video.ts = Date.now();
    await update<IEntry>(
      `dictionaries/${$dictionary.id}/words/${entry_id}`,
      { vfs: arrayUnion(video) },
      { abbreviate: true }
    );
  } catch (err) {
    alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
  }
}
