import type { ExpandedEntry } from '@living-dictionaries/types';
import { get } from 'svelte/store';
import { page } from '$app/stores';

export async function share(dictionaryId: string, entry: ExpandedEntry) {
  const { data: { t } } = get(page)
  const title = `${dictionaryId} ${t('misc.LD_singular')}`;
  const text = `${entry.lexeme}`;
  const url = `https://livingdictionaries.app/${dictionaryId}/entry/${entry.id}`;

  if (navigator.share) {
    await navigator.share({
      title,
      text,
      url,
    });
  } else {
    copy(`${text}, ${title}, ${url}`);
  }
}

function copy(message: string) {
  const { data: { t } } = get(page)

  try {
    const el = document.createElement('textarea');
    el.value = message;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert(t('entry.link_copied'));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    alert(`${t('entry.copy_and_share')} ${message}`);
  }
}
