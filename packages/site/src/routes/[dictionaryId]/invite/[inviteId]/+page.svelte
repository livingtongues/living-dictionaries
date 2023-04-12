<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IInvite, IHelper, IUser } from '@living-dictionaries/types';
  import { isManager, isContributor, user, dictionary } from '$lib/stores';
  import { Button, ShowHide } from 'svelte-pieces';
  import { Doc, setOnline, updateOnline } from 'sveltefirets';
  import { serverTimestamp } from 'firebase/firestore/lite';
  import type { PageData } from './$types';
  export let data: PageData;
  let inviteType: IInvite;

  async function acceptInvite(role: 'manager' | 'contributor') {
    try {
      const contributor: IHelper = {
        id: $user.uid,
        name: $user.displayName,
      };

      const collectionPath = `dictionaries/${$dictionary.id}/${
        role === 'manager' ? 'managers' : 'contributors'
      }/${$user.uid}`;
      await setOnline<IHelper>(collectionPath, contributor);

      await updateOnline<IInvite>(`dictionaries/${$dictionary.id}/invites/${data.inviteId}`, {
        status: 'claimed',
      });

      await updateOnline<IUser>(`users/${$user.uid}`, {
        termsAgreement: serverTimestamp(),
      });
    } catch (err) {
      alert(`${$_('misc.error')}: ${err}`);
    }
  }
</script>

<div>
  <Doc
    path={`dictionaries/${$dictionary.id}/invites/${data.inviteId}`}
    let:data={invite}
    startWith={inviteType}>
    {#if invite && invite.status === 'sent'}
      <p class="font-semibold mb-2">
        {$_('invite.invited_by', { default: 'Invited by' })}: {invite.inviterName}
      </p>
      <p class="font-semibold mb-2">
        {$_('invite.role', { default: 'Role' })}: {invite.role}
      </p>
      {#if $user}
        {#if ($isManager && invite.role === 'manager') || ($isContributor && invite.role === 'contributor')}
          <p class="mb-2">
            You are already a {invite.role}.
          </p>
          <Button href={`/${$dictionary.id}/entries/list`}>
            {$_('dictionary.entries', {
              default: 'Entries',
            })}
            &nbsp;
            <i class="fas fa-chevron-right rtl-x-flip" />
          </Button>
        {:else}
          <Button form="filled" onclick={() => acceptInvite(invite.role)}
            >{$_('invite.accept_invitation', {
              default: 'Accept Invitation',
            })}</Button>

          <div class="mt-2 text-sm text-gray-600">
            {$_('terms.agree_by_submit', {
              default: 'By submitting this form, you agree to our',
            })}
            <a href="/terms" class="underline" target="_blank">
              {$_('dictionary.terms_of_use', { default: 'Terms of Use' })}
            </a>
            .
          </div>
        {/if}
      {:else}
        <ShowHide let:show let:toggle>
          <Button form="text" onclick={toggle}>
            <i class="far fa-sign-in" />
            <span class="ml-1">
              {$_('header.login', { default: 'Sign In' })}
            </span>
          </Button>
          {#if show}
            {#await import('$lib/components/shell/AuthModal.svelte') then { default: AuthModal }}
              <AuthModal on:close={toggle} />
            {/await}
          {/if}
        </ShowHide>
      {/if}
    {:else if invite && invite.status === 'claimed'}
      <p class="font-semibold mb-2">
        {$_('invite.invitation_claimed', {
          default: 'Invitation claimed',
        })}: {invite.updatedAt &&
          invite.updatedAt.toDate().toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
      </p>

      <Button href={`/${$dictionary.id}/entries/list`}>
        {$_('dictionary.entries', {
          default: 'Entries',
        })}
        &nbsp;
        <i class="fas fa-chevron-right rtl-x-flip" />
      </Button>
    {:else}
      <p class="font-semibold">
        {$_('invite.invalid_invitation', {
          default: 'Invalid Invitation',
        })}
      </p>
    {/if}
  </Doc>
</div>
