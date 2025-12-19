<script lang="ts">
  import { Button, ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/state'

  let { data } = $props();
  let { user, dictionary, is_manager, is_contributor, invite, accept_invite } = $derived(data)
</script>

{#if invite?.status === 'sent'}
  <p class="font-semibold mb-2">
    {page.data.t('invite.invited_by')}: {invite.inviter_email}
  </p>
  <p class="font-semibold mb-2">
    {page.data.t('invite.role')}: {invite.role}
  </p>
  {#if user}
    {#if is_manager}
      <p class="mb-2">
        You are already a manager.
      </p>
      <Button href={`/${dictionary.id}/entries`}>
        {page.data.t('dictionary.entries')}
        <span class="i-fa6-solid-chevron-right rtl-x-flip -mt-1"></span>
      </Button>
    {:else if is_contributor && invite.role === 'contributor'}
      <p class="mb-2">
        You are already a contributor.
      </p>
      <Button href={`/${dictionary.id}/entries`}>
        {page.data.t('dictionary.entries')}
        <span class="i-fa6-solid-chevron-right rtl-x-flip -mt-1"></span>
      </Button>
    {:else}
      <Button form="filled" onclick={accept_invite}>{page.data.t('invite.accept_invitation')}</Button>

      <div class="mt-2 text-sm text-gray-600">
        {page.data.t('terms.agree_by_submit')}
        <a href="/terms" class="underline" target="_blank">
          {page.data.t('dictionary.terms_of_use')}
        </a>
        .
      </div>
    {/if}
  {:else}
    <ShowHide  >
      {#snippet children({ show, toggle })}
            <Button form="text" onclick={toggle}>
          <i class="far fa-sign-in"></i>
          <span class="ml-1">
            {page.data.t('header.login')}
          </span>
        </Button>
        {#if show}
          {#await import('$lib/components/shell/AuthModal.svelte') then { default: AuthModal }}
            <AuthModal on_close={toggle} />
          {/await}
        {/if}
                {/snippet}
        </ShowHide>
  {/if}
{:else if invite?.status === 'claimed'}
  <p class="font-semibold mb-2">
    {page.data.t('invite.invitation_claimed')}
  </p>

  <Button href={`/${dictionary.id}/entries`}>
    {page.data.t('dictionary.entries')}
    <span class="i-fa6-solid-chevron-right rtl-x-flip -mt-1"></span>
  </Button>
{:else if !user}
  {page.data.t('header.please_create_account')}
  <ShowHide  >
    {#snippet children({ show: hide, toggle })}
                {#if !hide}
        {#await import('$lib/components/shell/AuthModal.svelte') then { default: AuthModal }}
          <AuthModal
            context="force"
            on_close={toggle} />
        {/await}
      {/if}
                  {/snippet}
            </ShowHide>
{:else}
  <p class="font-semibold">
    {page.data.t('invite.invalid_invitation')}
  </p>
{/if}
