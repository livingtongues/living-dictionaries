<script lang="ts">
  import IconIcOutlineMail from '~icons/ic/outline-mail'
  import EditString from '../[dictionaryId]/EditString.svelte'
  import { Button } from '$lib/svelte-pieces'
  import { page } from '$app/state'
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
    {page.data.t('account.account_settings')}
  </title>
</svelte:head>

<Header>{page.data.t('account.account_settings')}</Header>

<div style="max-width: 768px; margin-left: auto; margin-right: auto; padding: 0.75rem">
  {#if user}
    {#if user.avatar_url && !broken_avatar_image}
      <img alt="Account Profile" style="margin-bottom: 0.5rem; width: 6rem; height: 6rem; border-radius: 0.25rem" src={user.avatar_url} onerror={() => broken_avatar_image = true} />
    {/if}

    <EditString
      value={user.name}
      minlength={2}
      required
      id="name"
      save={async name => await update_name(name)}
      display={page.data.t('account.your_name')} />
    <div style="margin-top: 0.75rem; font-size: 1.125rem; line-height: 1.75rem">
      <IconIcOutlineMail class="icon-inline" style="vertical-align: -4px" />
      {user.email}</div>
    <div style="margin-top: 0.75rem">
      <Button
        onclick={() => data.auth_user.logout()}>{page.data.t('account.log_out')}</Button>
    </div>
  {:else}
    Not logged in
  {/if}
</div>
