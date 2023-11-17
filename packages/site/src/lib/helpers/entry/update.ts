import { update } from 'sveltefirets';
import { get } from 'svelte/store';
import { page } from '$app/stores';

export function saveUpdateToFirestore({
  field,
  value,
  entryId,
}: {
  field: string;
  value: string | string[];
  entryId: string,
}
) {
  const { data: { t }, params: { dictionaryId } } = get(page)
  try {
    update(
      `dictionaries/${dictionaryId}/words/${entryId}`,
      { [field]: value },
      { abbreviate: true }
    );
  } catch (err) {
    alert(`${t('misc.error')}: ${err}`);
  }
}
