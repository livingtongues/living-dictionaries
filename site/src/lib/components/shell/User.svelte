<script lang="ts">
  import IconSignInAlt from '~icons/fa-solid/sign-in-alt'
  import { onMount } from 'svelte'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import Slideover from '$lib/components/ui/Slideover.svelte'
  import { display_one_tap_popover } from '$lib/auth/google-one-tap'
  import { page } from '$app/state'
  import { chat_store } from '$lib/chat/chat-store.svelte'
  import UserMenu from './UserMenu.svelte'

  const { auth_user } = $derived(page.data)
  const user = $derived(auth_user.user)
  let show_menu = $state(false)

  onMount(() => {
    if (location.origin.includes('vercel.app'))
      return
    if (user)
      return
    // console.warn is DEV-only (not patched into client_logs) — a rejected
    // one-tap prompt is benign (user dismissed / cookies blocked), and at
    // console.error it shipped ~29 useless `{isTrusted:true}` error rows/day.
    display_one_tap_popover().catch(error => console.warn('[google one-tap]', error))
  })

  let broken_avatar_image = $state(false)
</script>

{#if user}
  <div class="user-wrap">
    <button class="avatar-button" type="button" onclick={() => (show_menu = true)}>
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
      {#if auth_user.is_chat_member && chat_store.total_unread > 0}
        <!-- Unread-chat dot: subtle app-wide hint; the UserMenu link carries the count. -->
        <span class="unread-dot" title="Unread chat messages"></span>
      {/if}
    </button>
    {#if show_menu}
      <Slideover
        side={page.data.t('page.direction') === 'ltr' ? 'right' : 'left'}
        widthRem={18}
        on_close={() => (show_menu = false)}>
        <UserMenu close={() => (show_menu = false)} />
      </Slideover>
    {/if}
  </div>
{:else}
  <ShowHide>
    {#snippet children({ show, toggle })}
      <HeadlessButton class="btn-ghost btn-default" onclick={toggle}>
        <IconSignInAlt />
        <span class="login-label">
          {page.data.t('header.login')}
        </span>
      </HeadlessButton>
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
    position: relative;
  }

  .unread-dot {
    position: absolute;
    top: 0.2rem;
    right: 0.55rem;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--primary);
    border: 2px solid var(--background);
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
