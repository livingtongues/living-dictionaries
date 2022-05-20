import { _ } from 'svelte-i18n';
import { get } from 'svelte/store';

export function printGlosses(obj, shorten = false) {
  const $_ = get(_);
  Object.keys(obj).forEach((key) => !obj[key] && delete obj[key]);
  const keys = Object.keys(obj).sort();
  if (keys.length > 1) {
    return keys.map((bcp) => {
      if (obj[bcp]) {
        if (shorten) {
          return `${obj[bcp]}`;
        } else {
          return `${$_('gl.' + bcp)}: ${obj[bcp]}`;
        }
      }
    });
  } else {
    return [obj[keys[0]]];
  }
}

export function showEntryGlossLanguages(
  entryGlosses: { [key: string]: string },
  dictionaryLanguages: string[]
) {
  if (entryGlosses) {
    return [...new Set([...dictionaryLanguages, ...Object.keys(entryGlosses)])];
  }
  return [...new Set(dictionaryLanguages)];
}
