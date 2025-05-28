<script lang="ts">
  import { Button } from 'svelte-pieces'
  import EditString from '../[dictionaryId]/EditString.svelte'
  import { page } from '$app/stores'
  import Header from '$lib/components/shell/Header.svelte'
  import Footer from '$lib/components/shell/Footer.svelte'
  import { sign_out } from '$lib/supabase/auth'

  export let data
  $: ({ user } = data)

  let broken_avatar_image = false

  async function update_name(full_name: string) {
    const { error } = await data.supabase.auth.updateUser({
      data: { full_name },
    })
    if (error) {
      alert(`Error updating user:, ${error.message}`)
      console.error('Error updating user:', error.message)
    }
  }
</script>

<svelte:head>
  <title>
    {$page.data.t('account.account_settings')}
  </title>
</svelte:head>

<Header>{$page.data.t('account.account_settings')}</Header>

<div class="max-w-screen-md mx-auto p-3">
  {#if $user}
    {#if $user.user_metadata.avatar_url && !broken_avatar_image}
      <img alt="Account Profile" class="mb-2 w-24 h-24 rounded" src={$user.user_metadata.avatar_url} on:error={() => broken_avatar_image = true} />
    {/if}

    <EditString
      value={$user.user_metadata.full_name}
      minlength={2}
      required
      id="name"
      save={async name => await update_name(name)}
      display={$page.data.t('account.your_name')} />
    <div class="mt-3 text-lg">
      <span class="i-ic-outline-mail -align-4px"></span>
      {$user.email}</div>
    <div class="mt-3">
      <Button
        onclick={sign_out}>{$page.data.t('account.log_out')}</Button>
    </div>
  {:else}
    Not logged in
  {/if}
</div>

<Footer />
