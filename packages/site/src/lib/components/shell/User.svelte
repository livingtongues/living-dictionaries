<script lang="ts">
  import { Button, Menu, ShowHide } from '$lib/svelte-pieces'
  import { onMount } from 'svelte'
  import { display_one_tap_popover, sign_out } from '$lib/supabase/auth'
  import { page } from '$app/state'
  import { mode } from '$lib/supabase'
  import { api_update_dev_admin_role } from '$api/db/update-dev-admin-role/_call'
  import { invalidateAll } from '$app/navigation'
  import { dev } from '$app/environment'

  let { user, admin } = $derived(page.data)
  let show_menu = $state(false)
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
    if (!page.data.supabase)
      return
    display_one_tap_popover()
  })

  let broken_avatar_image = $state(false)
</script>

{#if $user}
  <div class="relative flex-shrink-0">
    <button class="px-3 py-1" type="button" onclick={toggle_menu}>
      {#if $user.user_metadata?.avatar_url && !broken_avatar_image}
        <img
          class="w-34px h-34px rounded-full"
          alt={$user.email[0]}
          src={$user.user_metadata.avatar_url}
          onerror={() => broken_avatar_image = true} />
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
            <i class="fas fa-key"></i>
          </a>
        {/if}
        <a href="/account"> {page.data.t('account.account_settings')} </a>
        <button type="button" onclick={sign_out}>{page.data.t('account.log_out')}</button>
        {#if dev || mode === 'development'}
          <button
            type="button"
            onclick={setAdminRole}>
            Dev: Set Admin Role Level (currently {$user.app_metadata.admin})
          </button>
        {/if}
      </Menu>
    {/if}
  </div>
{:else}
  <ShowHide  >
    {#snippet children({ show, toggle })}
        <Button form="text" onclick={toggle}>
        <i class="far fa-sign-in"></i>
        <span class="ml-1 hidden sm:inline">
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
