import type { IDictionary, IInvite } from '@ld/types';
import { addOnline } from '$sveltefirets';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { user } from '$lib/stores';

export async function inviteHelper(
  role: 'manager' | 'contributor' = 'contributor',
  dictionary: IDictionary
) {
  const $_ = get(_);
  const inviter = get(user);

  const targetEmail = prompt(`${$_('contact.email', { default: 'Email' })}?`);
  if (!targetEmail) return;

  const isEmail = /^\S+@\S+\.\S+$/.test(targetEmail);
  if (!isEmail) {
    return alert($_('misc.invalid', { default: 'Invalid Email' }));
  }

  try {
    const invite: IInvite = {
      inviterEmail: inviter.email,
      inviterName: inviter.displayName,
      dictionaryName: dictionary.name,
      targetEmail,
      role,
      status: 'queued',
    };
    await addOnline(`dictionaries/${dictionary.id}/invites`, invite);
  } catch (err) {
    alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    console.error(err);
  }
}
