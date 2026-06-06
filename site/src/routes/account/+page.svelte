<script lang="ts">
  import EditString from '../[dictionaryId]/EditString.svelte'
  import { Button } from '$lib/svelte-pieces'
  import { page } from '$app/stores'
  import Header from '$lib/components/shell/Header.svelte'

  const { data } = $props()
  const user = $derived(data.auth_user.user)

  let broken_avatar_image = $state(false)

  function update_name(_full_name: string) {
    // M4-write: profile name update lands with the write/sync milestone.
    alert('Saving profile changes will be enabled soon.')
  }
</script>

<svelte:head>
  <title>
    {$page.data.t('account.account_settings')}
  </title>
</svelte:head>

<Header>{$page.data.t('account.account_settings')}</Header>

<div class="max-w-screen-md mx-auto p-3">
  {#if user}
    {#if user.avatar_url && !broken_avatar_image}
      <img alt="Account Profile" class="mb-2 w-24 h-24 rounded" src={user.avatar_url} onerror={() => broken_avatar_image = true} />
    {/if}

    <EditString
      value={user.name}
      minlength={2}
      required
      id="name"
      save={async name => await update_name(name)}
      display={$page.data.t('account.your_name')} />
    <div class="mt-3 text-lg">
      <span class="i-ic-outline-mail -align-4px"></span>
      {user.email}</div>
    <div class="mt-3">
      <Button
        onclick={() => data.auth_user.logout()}>{$page.data.t('account.log_out')}</Button>
    </div>
  {:else}
    Not logged in
  {/if}
</div>
