import { glossingLanguages } from '$lib/mappings/glossing-languages';
import { _ } from 'svelte-i18n';
import { get } from 'svelte/store';

export function vernacularName(bcp: string) {
  if (glossingLanguages[bcp] && glossingLanguages[bcp].vernacularName) {
    return glossingLanguages[bcp].vernacularName;
  } else {
    const $_ = get(_);
    return `${$_('gl.' + bcp)}`;
  }
}
