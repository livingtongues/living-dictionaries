import { dictionary } from '$lib/stores';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

import type { IEntry } from '$lib/interfaces';
import { update } from '$sveltefire/firestorelite';

export async function deleteImage(entry: IEntry) {
  const $_ = get(_);
  try {
    const $dictionary = get(dictionary);
    await update(`dictionaries/${$dictionary.id}/words/${entry.id}`, { pf: null }, true);
  } catch (err) {
    alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
  }
}

export async function deleteAudio(entry: IEntry) {
  const $_ = get(_);
  try {
    const $dictionary = get(dictionary);
    await update(`dictionaries/${$dictionary.id}/words/${entry.id}`, { sf: null }, true);
  } catch (err) {
    alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
  }
}

export function deleteObjectEmptyFields(ObjData: any) {
  for (const key in ObjData) {
    if (ObjData[key] === '' || ObjData[key] === undefined || ObjData[key] === null) {
      delete ObjData[key];
    }
  }
}
