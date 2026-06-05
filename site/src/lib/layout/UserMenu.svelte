<script lang="ts">
  import type { AuthUser } from '$lib/auth/user.svelte.js'
  import ShowHide from '$lib/svelte-pieces/ShowHide.svelte'
  import Slideover from '$lib/svelte-pieces/Slideover.svelte'
  import IconMdiAccountCircle from '~icons/mdi/account-circle'
  import IconMdiLogout from '~icons/mdi/logout'

  interface Props {
    auth_user: AuthUser
    sign_out: () => void | Promise<void>
  }

  const { auth_user, sign_out }: Props = $props()

  const user = $derived(auth_user.user)
  const name = $derived(user?.name || user?.email || '')
  const initial = $derived((name || '?')[0].toUpperCase())
  let broken_avatar_image = $state(false)
</script>

{#if user}
  <ShowHide>
    {#snippet children({ show, toggle })}
      <button
        type="button"
        onclick={toggle}
        class="btn-ghost avatar-button"
        aria-label="Open user menu">
        {#if user.avatar_url && !broken_avatar_image}
          <img
            class="avatar-img"
            alt={initial}
            crossorigin=""
            src={user.avatar_url}
            onerror={() => broken_avatar_image = true} />
        {:else}
          <div class="avatar-fallback">{initial}</div>
        {/if}
      </button>
      {#if show}
        <Slideover on_close={toggle}>
          {#snippet title()}
            <a href="/account" onclick={toggle} class="user-link">
              {name}
              {#if user.email && user.email !== name}
                <div class="user-email">{user.email}</div>
              {/if}
            </a>
          {/snippet}
          <nav class="menu">
            <a href="/account" onclick={toggle} class="menu-item">
              <IconMdiAccountCircle style="font-size: 1.125rem" />Account
            </a>
            <button
              type="button"
              class="menu-item"
              onclick={async () => {
                toggle()
                await sign_out()
              }}>
              <IconMdiLogout style="font-size: 1.125rem" />Sign out
            </button>
          </nav>
        </Slideover>
      {/if}
    {/snippet}
  </ShowHide>
{/if}

<style>
  .avatar-button {
    padding: 0.25rem;
    border-radius: 9999px;
  }
  .avatar-img {
    width: 2rem;
    height: 2rem;
    border-radius: 9999px;
  }
  .avatar-fallback {
    width: 2rem;
    height: 2rem;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
    text-transform: uppercase;
    background: var(--surface);
    color: var(--color);
  }
  .user-link {
    color: var(--color);
    text-decoration: none;
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .user-link:hover {
    text-decoration: underline;
  }
  .user-email {
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .menu {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
  }
  .menu-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: var(--color);
    text-decoration: none;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    width: 100%;
  }
  .menu-item:hover {
    background: var(--surface);
  }
</style>
