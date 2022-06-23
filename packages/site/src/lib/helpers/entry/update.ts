import { update } from 'sveltefirets';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

export async function saveUpdateToFirestore(
  e: {
    detail: { field: string; newValue: string | string[] };
  },
  entryId: string,
  dictionaryId: string
) {
  const $_ = get(_);

  try {
    update(
      `dictionaries/${dictionaryId}/words/${entryId}`,
      {
        [e.detail.field]: e.detail.newValue,
      },
      { abbreviate: true }
    );
  } catch (err) {
    alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
  }
}
