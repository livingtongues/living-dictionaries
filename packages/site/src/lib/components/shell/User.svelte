<script lang="ts">
  import { Button, Menu, ShowHide } from 'svelte-pieces'
  import { onMount } from 'svelte'
  import { display_one_tap_popover, sign_out } from '$lib/supabase/auth'
  import { page } from '$app/stores'
  import { mode } from '$lib/supabase'
  import { api_update_dev_admin_role } from '$api/db/update-dev-admin-role/_call'
  import { invalidateAll } from '$app/navigation'

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
    const role_level = +prompt('Enter 0, 1, or 2')
    if (role_level !== 0 && role_level !== 1 && role_level !== 2)
      return
    const { error } = await api_update_dev_admin_role({ role_level })
    if (error) {
      console.error(error)
    } else {
      invalidateAll()
    }
  }

  onMount(() => {
    if (location.origin.includes('vercel.app'))
      return
    if ($user)
      return
    if (!$page.data.supabase)
      return
    display_one_tap_popover()
  })

  let broken_avatar_image = false
</script>

{#if $user}
  <div class="relative flex-shrink-0">
    <button class="px-3 py-1" type="button" on:click={toggle_menu}>
      {#if $user.user_metadata?.avatar_url && !broken_avatar_image}
        <img
          class="w-34px h-34px rounded-full"
          alt={$user.email[0]}
          src={$user.user_metadata.avatar_url}
          on:error={() => broken_avatar_image = true} />
      {:else}
        <div
          class="w-34px h-34px rounded-full flex items-center justify-center font-semibold bg-gray-100 hover:bg-gray-200 uppercase">
          {($user.user_metadata?.full_name || $user.email)[0]}
        </div>
      {/if}
    </button>
    {#if show_menu}
      <Menu portalTarget="#direction" class="right-2 rtl:left-2 top-11" onclickoutside={toggle_menu}>
        <div class="px-4 py-2 text-xs font-semibold text-gray-600">{$user.user_metadata?.full_name || $user.email}</div>
        {#if $user.user_metadata?.full_name}
          <div class="px-4 py-2 -mt-3 text-xs text-gray-600 border-b">{$user.email}</div>
        {/if}
        {#if $admin}
          <a href="/admin">
            Admin Panel
            <i class="fas fa-key" />
          </a>
        {/if}
        <a href="/account"> {$page.data.t('account.account_settings')} </a>
        <button type="button" on:click={sign_out}>{$page.data.t('account.log_out')}</button>
        {#if mode === 'development'}
          <button
            type="button"
            on:click={setAdminRole}>
            Dev: Set Admin Role Level (currently {$user.app_metadata.admin})
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
        <AuthModal on_close={toggle} />
      {/await}
    {/if}
  </ShowHide>
{/if}
