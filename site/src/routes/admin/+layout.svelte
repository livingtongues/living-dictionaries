<script lang="ts">
  import { beforeNavigate, goto, invalidateAll } from '$app/navigation'
  import { page } from '$app/state'
  import { chat_store } from '$lib/admin/chat/chat-store.svelte'
  import LoginModal from '$lib/components/LoginModal.svelte'
  import SyncStatus from '$lib/db/sync/SyncStatus.svelte'
  import ShowHide from '$lib/svelte-pieces/ShowHide.svelte'
  import UserMenu from '$lib/layout/UserMenu.svelte'
  import { onMount } from 'svelte'
  import IconMdiArrowLeft from '~icons/mdi/arrow-left'
  import IconMdiShieldAccount from '~icons/mdi/shield-account'

  let { children, data } = $props()

  const nav_links = [
    { href: '/admin/messages', label: 'Messages' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/team', label: 'Team' },
    { href: '/admin/dictionaries', label: 'Dictionaries' },
    { href: '/admin/sync', label: 'Sync' },
    { href: '/admin/schema', label: 'Schema' },
    { href: '/admin/api-docs', label: 'Agent API' },
    { href: '/admin/triage-examples', label: 'Triage' },
    { href: '/admin/legal-review', label: 'Legal' },
  ]
  function is_active(href: string): boolean {
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)
  }

  async function sign_out() {
    await data.auth_user.logout()
    await invalidateAll()
    await goto('/')
  }

  onMount(() => {
    if (!data.sync)
      return
    void data.sync.sync()

    function on_visibility() {
      if (document.visibilityState === 'visible')
        void data.sync?.sync_on_resume()
    }
    function on_before_unload(event: BeforeUnloadEvent) {
      if (!data.sync || data.sync.total_dirty === 0)
        return
      void data.sync.sync_if_needed()
      event.preventDefault()
      event.returnValue = ''
    }
    document.addEventListener('visibilitychange', on_visibility)
    window.addEventListener('beforeunload', on_before_unload)
    return () => {
      document.removeEventListener('visibilitychange', on_visibility)
      window.removeEventListener('beforeunload', on_before_unload)
    }
  })

  beforeNavigate(() => {
    void data.sync?.sync_if_needed()
  })

  // App-wide chat background poll: keeps presence + the Team unread badge live
  // across the whole admin area (the Team page adds the faster per-room poll).
  onMount(() => {
    chat_store.start_background()
    return () => chat_store.stop_background()
  })
</script>

<svelte:head>
  <title>Admin · Living Dictionaries</title>
</svelte:head>

{#if !data.auth_user.user}
  <div class="signed-out">
    <IconMdiShieldAccount style="font-size: 2rem; color: var(--primary)" />
    <h1 class="signed-out-title">Admin area</h1>
    <p class="signed-out-text">Please sign in to continue.</p>
    <ShowHide>
      {#snippet children({ show, toggle })}
        <button type="button" class="btn-primary btn-default" onclick={toggle}>Sign in</button>
        {#if show}
          <LoginModal on_close={toggle} />
        {/if}
      {/snippet}
    </ShowHide>
  </div>
{:else}
  <div class="page">
    <header class="page-header">
      <div class="header-row">
        <a href="/" class="back-link" title="Back to site">
          <IconMdiArrowLeft style="font-size: 1.25rem" />
        </a>
        <a href="/admin" class="brand-link">
          <IconMdiShieldAccount style="font-size: 1.25rem; color: var(--primary)" />
          Admin
        </a>
        <nav class="admin-nav">
          {#each nav_links as link (link.href)}
            <a href={link.href} class={['nav-link', { active: is_active(link.href) }]}>
              {link.label}
              {#if link.href === '/admin/team' && chat_store.total_unread > 0}
                <span class="nav-badge">{chat_store.total_unread}</span>
              {/if}
            </a>
          {/each}
        </nav>
        <div class="header-right">
          {#if data.sync}
            <SyncStatus sync={data.sync} />
          {/if}
          <UserMenu auth_user={data.auth_user} {sign_out} />
        </div>
      </div>
    </header>

    <main class="page-main">
      {@render children()}
    </main>
  </div>
{/if}

<style>
  .page {
    min-height: 100vh;
    background: var(--background);
    color: var(--color);
  }
  .page-header {
    border-bottom: 1px solid var(--border-color);
  }
  .header-row {
    width: 100%;
    padding-left: 1rem;
    padding-right: 1rem;
    display: flex;
    align-items: center;
    gap: 1.5rem;
    height: 3.5rem;
  }
  .back-link {
    display: flex;
    align-items: center;
    color: var(--color-secondary);
    text-decoration: none;
  }
  .back-link:hover {
    color: var(--color);
  }
  .brand-link {
    font-weight: 700;
    font-size: 1.125rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color);
    text-decoration: none;
  }
  .admin-nav {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
  }
  .nav-link {
    padding: 0.25rem 0.625rem;
    border-radius: 0.375rem;
    text-decoration: none;
    color: var(--color-secondary);
    transition: background-color 0.15s, color 0.15s;
  }
  .nav-link:hover {
    color: var(--color);
    background: var(--surface);
  }
  .nav-link.active {
    color: var(--primary);
    font-weight: 600;
    background: color-mix(in srgb, var(--primary), transparent 88%);
  }
  .nav-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }
  .nav-badge {
    background: var(--primary);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
    min-width: 1.1rem;
    height: 1.1rem;
    padding: 0 0.3rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .header-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .page-main {
    padding-left: 1rem;
    padding-right: 1rem;
    width: 100%;
    padding-top: 0.75rem;
    padding-bottom: 1.5rem;
  }
  .signed-out {
    min-height: 100vh;
    background: var(--background);
    color: var(--color);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    text-align: center;
  }
  .signed-out-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }
  .signed-out-text {
    color: var(--color-secondary);
    margin: 0 0 0.5rem;
  }
</style>
