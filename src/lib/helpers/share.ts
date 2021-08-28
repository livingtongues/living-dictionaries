import type { IEntry } from '$lib/interfaces';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';

export async function share(dictionaryId: string, entry: IEntry) {
  const $_ = get(_);
  const title = `${dictionaryId} ${$_('misc.LD_singular', { default: 'Living Dictionary' })}`;
  const text = `${entry.lx}`;
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
  const $_ = get(_);

  try {
    const el = document.createElement('textarea');
    el.value = message;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert($_('entry.link_copied', { default: 'Link copied' }));
  } catch (e) {
    alert(`${$_('entry.copy_and_share', { default: 'Copy and share:' })} ${message}`);
  }
}
