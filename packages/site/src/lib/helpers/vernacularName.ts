import { glossingLanguages } from '$lib/glosses/glossing-languages';
import { t } from 'svelte-i18n';
import { get } from 'svelte/store';

export function vernacularName(bcp: string) {
  if (glossingLanguages[bcp]?.vernacularName)
    return glossingLanguages[bcp].vernacularName;

  const $t = get(t);
  return `${$t('gl.' + bcp)}`;

}

