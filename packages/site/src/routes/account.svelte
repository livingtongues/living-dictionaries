<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { user } from '$lib/stores';
  import Header from '$lib/components/shell/Header.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { logOut } from '$sveltefirets';
</script>

<svelte:head>
  <title>
    {$_('account.account_settings', { default: 'Account Settings' })}
  </title>
</svelte:head>

<Header>{$_('account.account_settings', { default: 'Account Settings' })}</Header>

<div class="max-w-screen-md mx-auto p-3">
  {#if $user}
    {#if $user.photoURL}
      <img alt="Account Profile" class="mb-2 w-24 h-24 rounded" src={$user.photoURL} />
    {/if}
    <div class="font-semibold">{$user.displayName}</div>
    <div>{$user.email}</div>
    <div class="my-2">
      <Button onclick={logOut}
        >{$_('account.log_out', {
          default: 'Log Out',
        })}</Button>
    </div>
  {:else}Not signed in{/if}
</div>
