import { update } from 'sveltefirets';
import { get } from 'svelte/store';
import { t } from 'svelte-i18n';

export async function saveUpdateToFirestore({
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
    const $t = get(t);
    alert(`${$t('misc.error', { default: 'Error' })}: ${err}`);
  }
}
