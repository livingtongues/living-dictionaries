import { update } from 'sveltefirets';
import { get } from 'svelte/store';
import { t } from 'svelte-i18n';

export async function saveUpdateToFirestore(
  e: {
    detail: { field: string; newValue: string | string[] };
  },
  entryId: string,
  dictionaryId: string
) {
  const $t = get(t);

  try {
    update(
      `dictionaries/${dictionaryId}/words/${entryId}`,
      {
        [e.detail.field]: e.detail.newValue,
      },
      { abbreviate: true }
    );
  } catch (err) {
    alert(`${$t('misc.error', { default: 'Error' })}: ${err}`);
  }
}
