<script lang="ts">
  import { Button, ShowHide } from 'svelte-pieces'
  import { page } from '$app/stores'

  export let data
  $: ({ user, dictionary, is_manager, is_contributor, invite, accept_invite } = data)
</script>

<div>
  {#if invite?.status === 'sent'}
    <p class="font-semibold mb-2">
      {$page.data.t('invite.invited_by')}: {invite.inviterName}
    </p>
    <p class="font-semibold mb-2">
      {$page.data.t('invite.role')}: {invite.role}
    </p>
    {#if $user}
      {#if $is_manager}
        <p class="mb-2">
          You are already a manager.
        </p>
        <Button href={`/${dictionary.id}/entries`}>
          {$page.data.t('dictionary.entries')}
          <span class="i-fa6-solid-chevron-right rtl-x-flip -mt-1" />
        </Button>
      {:else if $is_contributor && invite.role === 'contributor'}
        <p class="mb-2">
          You are already a contributor.
        </p>
        <Button href={`/${dictionary.id}/entries`}>
          {$page.data.t('dictionary.entries')}
          <span class="i-fa6-solid-chevron-right rtl-x-flip -mt-1" />
        </Button>
      {:else}
        <Button form="filled" onclick={async () => await accept_invite(invite.role)}>{$page.data.t('invite.accept_invitation')}</Button>

        <div class="mt-2 text-sm text-gray-600">
          {$page.data.t('terms.agree_by_submit')}
          <a href="/terms" class="underline" target="_blank">
            {$page.data.t('dictionary.terms_of_use')}
          </a>
          .
        </div>
      {/if}
    {:else}
      <ShowHide let:show let:toggle>
        <Button form="text" onclick={toggle}>
          <i class="far fa-sign-in" />
          <span class="ml-1">
            {$page.data.t('header.login')}
          </span>
        </Button>
        {#if show}
          {#await import('$lib/components/shell/AuthModal.svelte') then { default: AuthModal }}
            <AuthModal on:close={toggle} />
          {/await}
        {/if}
      </ShowHide>
    {/if}
  {:else if invite?.status === 'claimed'}
    <p class="font-semibold mb-2">
      {$page.data.t('invite.invitation_claimed')}: {invite.updatedAt?.toDate().toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
    </p>

    <Button href={`/${dictionary.id}/entries`}>
      {$page.data.t('dictionary.entries')}
      <span class="i-fa6-solid-chevron-right rtl-x-flip -mt-1" />
    </Button>
  {:else}
    <p class="font-semibold">
      {$page.data.t('invite.invalid_invitation')}
    </p>
  {/if}
</div>
