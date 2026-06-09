<script lang="ts">
  import { onMount } from 'svelte'
  import { Button, Menu, ShowHide } from '$lib/svelte-pieces'
  import { display_one_tap_popover } from '$lib/auth/google-one-tap'
  import { page } from '$app/stores'
  import UserMenu from './UserMenu.svelte'

  const { auth_user } = $derived($page.data)
  const user = $derived(auth_user.user)
  let show_menu = $state(false)
  function toggle_menu() {
    const state = show_menu
    setTimeout(() => {
      if (state === show_menu)
        show_menu = !state
    }, 1)
  }

  onMount(() => {
    if (location.origin.includes('vercel.app'))
      return
    if (user)
      return
    display_one_tap_popover().catch(error => console.error('[google one-tap]', error))
  })

  let broken_avatar_image = $state(false)
</script>

{#if user}
  <div class="relative flex-shrink-0">
    <button class="px-3 py-1" type="button" onclick={toggle_menu}>
      {#if user.avatar_url && !broken_avatar_image}
        <img
          class="w-34px h-34px rounded-full"
          alt={user.email?.[0]}
          src={user.avatar_url}
          onerror={() => broken_avatar_image = true} />
      {:else}
        <div
          class="w-34px h-34px rounded-full flex items-center justify-center font-semibold bg-gray-100 hover:bg-gray-200 uppercase">
          {(user.name || user.email)[0]}
        </div>
      {/if}
    </button>
    {#if show_menu}
      <Menu portalTarget="#direction" class="right-2 rtl:left-2 top-11" onclickoutside={toggle_menu}>
        <UserMenu close={() => (show_menu = false)} />
      </Menu>
    {/if}
  </div>
{:else}
  <ShowHide>
    {#snippet children({ show, toggle })}
      <Button form="text" onclick={toggle}>
        <i class="far fa-sign-in"></i>
        <span class="ml-1 hidden sm:inline">
          {$page.data.t('header.login')}
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
