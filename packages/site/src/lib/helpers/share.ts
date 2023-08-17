import type { ExpandedEntry } from '@living-dictionaries/types';
import { get } from 'svelte/store';
import { t } from 'svelte-i18n';

export async function share(dictionaryId: string, entry: ExpandedEntry) {
  const $t = get(t);
  const title = `${dictionaryId} ${$t('misc.LD_singular', { default: 'Living Dictionary' })}`;
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

function copy(message) {
  const $t = get(t);

  try {
    const el = document.createElement('textarea');
    el.value = message;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert($t('entry.link_copied', { default: 'Link copied' }));
  } catch (e) {
    alert(`${$t('entry.copy_and_share', { default: 'Copy and share:' })} ${message}`);
  }
}
