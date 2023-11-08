import { update } from 'sveltefirets';
import { get } from 'svelte/store';
import { page } from '$app/stores';

export function saveUpdateToFirestore({
  field,
  value,
  entryId,
  dictionaryId,
}: {
  field: string;
  value: string | string[];
  entryId: string,
  dictionaryId: string
}
) {
  try {
    update(
      `dictionaries/${dictionaryId}/words/${entryId}`,
      { [field]: value },
      { abbreviate: true }
    );
  } catch (err) {
    const { data: { t } } = get(page)
    alert(`${t('misc.error')}: ${err}`);
  }
}
