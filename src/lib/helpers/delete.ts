import { dictionary } from '$lib/stores';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import type { IEntry } from '$lib/interfaces';
import { updateOnline } from '$sveltefirets';

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
