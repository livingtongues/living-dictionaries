<script lang="ts">
  import { onMount } from 'svelte'
  import { Button, Menu, ShowHide } from '$lib/svelte-pieces'
  import { display_one_tap_popover } from '$lib/auth/google-one-tap'
  import { page } from '$app/state'
  import UserMenu from './UserMenu.svelte'

  const { auth_user } = $derived(page.data)
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
  <div class="user-wrap">
    <button class="avatar-button" type="button" onclick={toggle_menu}>
      {#if user.avatar_url && !broken_avatar_image}
        <img
          class="avatar"
          alt={user.email?.[0]}
          src={user.avatar_url}
          onerror={() => broken_avatar_image = true} />
      {:else}
        <div class="avatar avatar-fallback">
          {(user.name || user.email)[0]}
        </div>
      {/if}
    </button>
    {#if show_menu}
      <Menu portalTarget="#direction" class="user-menu-position" onclickoutside={toggle_menu}>
        <UserMenu close={() => (show_menu = false)} />
      </Menu>
    {/if}
  </div>
{:else}
  <ShowHide>
    {#snippet children({ show, toggle })}
      <Button form="text" onclick={toggle}>
        <i class="far fa-sign-in"></i>
        <span class="login-label">
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

<style>
  .user-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .avatar-button {
    padding: 0.25rem 0.75rem;
  }

  .avatar {
    width: 34px;
    height: 34px;
    border-radius: 9999px;
  }

  .avatar-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    background-color: var(--surface);
    text-transform: uppercase;
  }

  .avatar-fallback:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%);
  }

  /* The Menu portals to #direction (outside this subtree), so the positioning class
     can't be ancestor-scoped (was `right-2 rtl:left-2 top-11` on the class prop). */
  :global(.user-menu-position) {
    right: 0.5rem;
    top: 2.75rem;
  }

  :global([dir='rtl'] .user-menu-position) {
    left: 0.5rem;
  }

  .login-label {
    margin-left: 0.25rem;
    display: none;
  }

  @media (min-width: 640px) {
    .login-label {
      display: inline;
    }
  }
</style>
