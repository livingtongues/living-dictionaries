import type { IDictionary, IInvite } from '@living-dictionaries/types';
import { get } from 'svelte/store';
import { page } from '$app/stores';
import { authState } from 'sveltefirets';
import type { InviteRequestBody } from '$api/email/invite/+server';
import { post_request } from './get-post-requests';

export async function inviteHelper(
  role: 'manager' | 'contributor',
  dictionary: IDictionary,
) {
  const { data: { t, user } } = get(page)
  const $user = get(user)

  const targetEmail = prompt(`${t('contact.email')}?`);
  if (!targetEmail) return;

  const isEmail = /^\S+@\S+\.\S+$/.test(targetEmail);
  if (!isEmail)
    return alert(t('misc.invalid'));


  try {
    const invite: IInvite = {
      inviterEmail: $user.email,
      inviterName: $user.displayName,
      dictionaryName: dictionary.name,
      targetEmail,
      role,
      status: 'queued',
    };

    const auth_state_user = get(authState);
    const auth_token = await auth_state_user.getIdToken();

    const { error } = await post_request<InviteRequestBody, null>('/api/email/invite', {
      auth_token,
      dictionaryId: dictionary.id,
      invite
    });

    if (error)
      throw new Error(error.message);

  } catch (err) {
    alert(`${t('misc.error')}: ${err}`);
    console.error(err);
  }
}
