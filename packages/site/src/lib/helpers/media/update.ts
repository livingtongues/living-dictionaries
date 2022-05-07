import type { IEntry, IVideo } from '@living-dictionaries/types';
import { update } from '$sveltefirets';
import { get } from 'svelte/store';
import { dictionary } from '$lib/stores';
import { arrayUnion } from 'firebase/firestore';
import { _ } from 'svelte-i18n';

export async function addVideo(entry: IEntry, video: IVideo) {
  const $_ = get(_);
  try {
    const $dictionary = get(dictionary);
    video.ts = Date.now();
    await update<IEntry>(
      `dictionaries/${$dictionary.id}/words/${entry.id}`,
      { vfs: arrayUnion(video) },
      { abbreviate: true }
    );
  } catch (err) {
    alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
  }
}
