<script lang="ts">
  import { authState, firebaseConfig, logOut } from 'sveltefirets'
  import { Avatar, Button, Menu, ShowHide } from 'svelte-pieces'
  import { get } from 'svelte/store'
  import { page } from '$app/stores'
  import { post_request } from '$lib/helpers/get-post-requests'
  import type { UpdateDevAdminRoleRequestBody } from '$api/db/update-dev-admin-role/+server'

  $: ({ user, admin } = $page.data)
  let show_menu = false
  function toggle_menu() {
    const state = show_menu
    setTimeout(() => {
      if (state === show_menu)
        show_menu = !state
    }, 1)
  }

  async function setAdminRole() {
    const role = +prompt('Enter 0, 1, or 2')
    if (role !== 0 && role !== 1 && role !== 2)
      return
    const auth_state_user = get(authState)
    const auth_token = await auth_state_user.getIdToken()
    const { error } = await post_request<UpdateDevAdminRoleRequestBody, any>('/api/db/update-dev-admin-role', { role, auth_token })
    if (error)
      console.error(error)
  }
</script>

{#if $user}
  <div class="relative flex-shrink-0">
    <button class="px-3 py-1" type="button" on:click={toggle_menu}>
      <Avatar user={$user} />
    </button>
    {#if show_menu}
      <Menu portalTarget="#direction" class="right-2 rtl:left-2 top-11" onclickoutside={toggle_menu}>
        <div class="px-4 py-2 text-xs font-semibold text-gray-600">{$user.displayName}</div>
        <div class="px-4 py-2 -mt-3 text-xs text-gray-600 border-b">{$user.email}</div>
        {#if $admin}
          <a href="/admin">
            Admin Panel
            <i class="fas fa-key" />
          </a>
        {/if}
        <a href="/account"> {$page.data.t('account.account_settings')} </a>
        <button type="button" on:click={logOut}>{$page.data.t('account.log_out')}</button>
        {#if firebaseConfig.projectId === 'talking-dictionaries-dev'}
          <button
            type="button"
            on:click={setAdminRole}>
            Set Admin Role Level (dev only)
          </button>
        {/if}
      </Menu>
    {/if}
  </div>
{:else}
  <ShowHide let:show let:toggle>
    <Button form="text" onclick={toggle}>
      <i class="far fa-sign-in" />
      <span class="ml-1 hidden sm:inline">
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
