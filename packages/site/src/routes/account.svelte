<script lang="ts">
  import { _ } from 'svelte-i18n';
  import View from '$lib/components/ui/View.svelte';
  import { user } from '$lib/stores';
  import Header from '$lib/components/shell/Header.svelte';
  import Button from '$svelteui/ui/Button.svelte';
  import { getStores } from '$app/stores';
  import { logOut } from '$sveltefirets';
  const { session } = getStores();
</script>

<svelte:head>
  <title>
    {$_('account.account_settings', { default: 'Account Settings' })}
  </title>
</svelte:head>

<Header>{$_('account.account_settings', { default: 'Account Settings' })}</Header>

<View padding={true} maxWidth={true}>
  {#if $user}
    {#if $user.photoURL}
      <img alt="Account Profile" class="mb-2" src={$user.photoURL} />
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
</View>

<style>
  img {
    @apply w-24 h-24 rounded;
  }
</style>
