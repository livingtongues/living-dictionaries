import { _ } from 'svelte-i18n';
import { get } from 'svelte/store';

export function printGlosses(obj) {
  const $_ = get(_);
  Object.keys(obj).forEach((key) => !obj[key] && delete obj[key]);
  const keys = Object.keys(obj).sort();
  if (keys.length > 1) {
    return keys.map((bcp) => {
      if (obj[bcp]) {
        return `${$_('gl.' + bcp)}: ${obj[bcp]}`;
      }
    });
  } else {
    return [obj[keys[0]]];
  }
}
