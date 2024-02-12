import type { IDictionary, IInvite } from '@living-dictionaries/types';
import { get } from 'svelte/store';
import { page } from '$app/stores';
import { user } from '$lib/stores';
import { apiFetch } from '$lib/client/apiFetch';
import { authState } from 'sveltefirets';
import type { InviteRequestBody } from '$api/email/invite/+server';

export async function inviteHelper(
  role: 'manager' | 'contributor' = 'contributor',
  dictionary: IDictionary
) {
  const { data: { t } } = get(page)
  const inviter = get(user);

  const targetEmail = prompt(`${t('contact.email')}?`);
  if (!targetEmail) return;

  const isEmail = /^\S+@\S+\.\S+$/.test(targetEmail);
  if (!isEmail)
    return alert(t('misc.invalid'));


  try {
    const invite: IInvite = {
      inviterEmail: inviter.email,
      inviterName: inviter.displayName,
      dictionaryName: dictionary.name,
      targetEmail,
      role,
      status: 'queued',
    };

    const auth_state_user = get(authState);
    const auth_token = await auth_state_user.getIdToken();

    const response = await apiFetch<InviteRequestBody>('/api/email/invite', {
      auth_token,
      dictionaryId: dictionary.id,
      invite
    });

    if (response.status !== 200) {
      const body = await response.json();
      throw new Error(body.message);
    }
  } catch (err) {
    alert(`${t('misc.error')}: ${err}`);
    console.error(err);
  }
}
