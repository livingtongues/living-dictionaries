import { glossingLanguages } from '$lib/glosses/glossing-languages';
import { _ } from 'svelte-i18n';
import { get } from 'svelte/store';

export function vernacularName(bcp: string) {
  if (glossingLanguages[bcp]?.vernacularName)
    return glossingLanguages[bcp].vernacularName;

  const $_ = get(_);
  return `${$_('gl.' + bcp)}`;

}

