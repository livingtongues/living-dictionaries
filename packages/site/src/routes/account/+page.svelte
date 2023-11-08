<script lang="ts">
  import { page } from '$app/stores';
  import { user } from '$lib/stores';
  import Header from '$lib/components/shell/Header.svelte';
  import { logOut } from 'sveltefirets';
  import { Button, ShowHide } from 'svelte-pieces';
</script>

<svelte:head>
  <title>
    {$page.data.t('account.account_settings')}
  </title>
</svelte:head>

<Header>{$page.data.t('account.account_settings')}</Header>

<div class="max-w-screen-md mx-auto p-3">
  {#if $user}
    {#if $user.photoURL}
      <img alt="Account Profile" class="mb-2 w-24 h-24 rounded" src={$user.photoURL} />
    {/if}
    <div class="font-semibold">{$user.displayName}</div>
    <div>{$user.email}</div>
    <div class="my-2">
      <Button onclick={logOut}>{$page.data.t('account.log_out')}</Button>
    </div>
  {:else}
    Not logged in
    <ShowHide let:show let:toggle>
      {#if !show}
        {#await import('$lib/components/shell/AuthModal.svelte') then { default: AuthModal }}
          <AuthModal on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  {/if}
</div>
