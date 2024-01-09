import { update } from 'sveltefirets';
import { get } from 'svelte/store';
import { page } from '$app/stores';

export function updateFirestoreDictionary({
  field,
  value,
}: {
  field: string;
  value: string | string[];
}
) {
  const { data: { t }, params: { dictionaryId } } = get(page);
  try {
    update(
      `dictionaries/${dictionaryId}`,
      { [field]: value },
      { abbreviate: true }
    );
  } catch (err) {
    alert(`${t('misc.error')}: ${err}`);
  }
}
