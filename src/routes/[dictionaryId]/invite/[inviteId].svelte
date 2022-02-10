<script context="module" lang="ts">
  import type { Load } from '@sveltejs/kit';
  export const load: Load = async ({ page: { params } }) => {
    return {
      props: {
        inviteId: params.inviteId,
        dictionaryId: params.dictionaryId,
      },
    };
  };
</script>

<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IInvite, IContributor, IManager, IUser } from '$lib/interfaces';
  import { isManager, isContributor, user } from '$lib/stores';

  export let inviteId: string, dictionaryId: string;
  let inviteType: IInvite;

  import { Doc, setOnline, updateOnline } from '$sveltefirets';
  import { serverTimestamp } from 'firebase/firestore/lite';

  async function acceptInvite(role: 'manager' | 'contributor') {
    try {
      const contributor: IContributor | IManager = {
        id: $user.uid,
        name: $user.displayName,
      };

      if (role === 'manager') {
        await setOnline<IManager>(
          `dictionaries/${dictionaryId}/managers/${$user.uid}`,
          contributor
        );
      } else {
        await setOnline<IContributor>(
          `dictionaries/${dictionaryId}/contributors/${$user.uid}`,
          contributor
        );
      }

      await updateOnline<IInvite>(`dictionaries/${dictionaryId}/invites/${inviteId}`, {
        status: 'claimed',
      });

      await updateOnline<IUser>(`users/${$user.uid}`, {
        // @ts-ignore
        termsAgreement: serverTimestamp(),
      });
    } catch (err) {
      alert(`${$_('misc.error')}: ${err}`);
    }
  }

  import Button from '$svelteui/ui/Button.svelte';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
</script>

<div>
  <Doc
    path={`dictionaries/${dictionaryId}/invites/${inviteId}`}
    let:data={invite}
    startWith={inviteType}
  >
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
          <Button href={`/${dictionaryId}/entries/list`}>
            {$_('dictionary.entries', {
              default: 'Entries',
            })}
            &nbsp;
            <i class="fas fa-chevron-right rtl-x-flip" />
          </Button>
        {:else}
          <Button form={'primary'} onclick={() => acceptInvite(invite.role)}
            >{$_('invite.accept_invitation', {
              default: 'Accept Invitation',
            })}</Button
          >

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
          <Button form="text" class="print:hidden" onclick={toggle}>
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

      <Button href={`/${dictionaryId}/entries/list`}>
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
