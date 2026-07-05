<script lang="ts">
  import type { Component } from 'svelte'
  import { beforeNavigate } from '$app/navigation'
  import { page } from '$app/state'
  import { chat_store } from '$lib/chat/chat-store.svelte'
  import LoginModal from '$lib/components/LoginModal.svelte'
  import User from '$lib/components/shell/User.svelte'
  import SyncStatus from '$lib/db/sync/SyncStatus.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { onMount } from 'svelte'
  import IconMdiAccountMultipleOutline from '~icons/mdi/account-multiple-outline'
  import IconMdiApi from '~icons/mdi/api'
  import IconMdiArrowLeft from '~icons/mdi/arrow-left'
  import IconMdiBookMultipleOutline from '~icons/mdi/book-multiple-outline'
  import IconMdiChartLine from '~icons/mdi/chart-line'
  import IconMdiCloudSync from '~icons/mdi/cloud-sync'
  import IconMdiFilterVariant from '~icons/mdi/filter-variant'
  import IconMdiForumOutline from '~icons/mdi/forum-outline'
  import IconMdiHeartPulse from '~icons/mdi/heart-pulse'
  import IconMdiImageMultipleOutline from '~icons/mdi/image-multiple-outline'
  import IconMdiMessageTextOutline from '~icons/mdi/message-text-outline'
  import IconMdiRobotOutline from '~icons/mdi/robot-outline'
  import IconMdiScaleBalance from '~icons/mdi/scale-balance'
  import IconMdiShieldAccount from '~icons/mdi/shield-account'
  import IconMdiTableCog from '~icons/mdi/table-cog'

  let { children, data } = $props()

  const admin_level = $derived(data.auth_user.admin_level)

  interface NavLink { href: string, label: string, icon: Component, compact?: boolean, min_level?: number }
  const all_nav_links: NavLink[] = [
    { href: '/admin/messages', label: 'Messages', icon: IconMdiMessageTextOutline },
    { href: '/admin/users', label: 'Users', icon: IconMdiAccountMultipleOutline, compact: true },
    // Chat lives OUTSIDE /admin (membership-based — partners + super managers
    // join too), but admins keep this entry point + unread badge.
    { href: '/chat', label: 'Chat', icon: IconMdiForumOutline },
    { href: '/admin/dictionaries', label: 'Dictionaries', icon: IconMdiBookMultipleOutline },
    // Bucket triage: serve / tolerate / delete classification of every dict.
    { href: '/admin/buckets', label: 'Buckets', icon: IconMdiFilterVariant, compact: true },
    // Dev tools — `compact` renders them icon-only on desktop (labels still
    // hide on mobile, where every link is icon-only anyway). Analytics + Schema
    // are Super Admin only (level 3) — raw log/db internals.
    { href: '/admin/analytics', label: 'Analytics', icon: IconMdiChartLine, compact: true, min_level: 3 },
    { href: '/admin/health', label: 'Health', icon: IconMdiHeartPulse, compact: true, min_level: 3 },
    { href: '/admin/schema', label: 'Schema', icon: IconMdiTableCog, compact: true, min_level: 3 },
    { href: '/admin/api-docs', label: 'API', icon: IconMdiApi, compact: true },
    { href: '/admin/triage-examples', label: 'Triage', icon: IconMdiRobotOutline, compact: true },
    { href: '/admin/legal-review', label: 'Legal', icon: IconMdiScaleBalance, compact: true },
    { href: '/admin/featured-words', label: 'Featured', icon: IconMdiImageMultipleOutline, compact: true },
    // Sync last — icon-only (SyncStatus widget), always visible.
    { href: '/admin/sync', label: 'Sync', icon: IconMdiCloudSync },
  ]
  const nav_links = $derived(all_nav_links.filter(link => !link.min_level || admin_level >= link.min_level))

  function is_active(href: string): boolean {
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)
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

  // Admin-area chat loops: the unread badge poll + the presence heartbeat
  // (being anywhere in /admin counts as online — the Chat nav badge is visible).
  onMount(() => {
    chat_store.start_rooms_poll()
    chat_store.start_presence()
    return () => chat_store.stop_presence()
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
        <a href="/admin" class="brand-link" title="Admin">
          <IconMdiShieldAccount style="font-size: 1.25rem; color: var(--primary)" />
          <span class="brand-label">Admin</span>
        </a>
        <nav class="admin-nav">
          {#each nav_links as link (link.href)}
            {@const Icon = link.icon}
            {@const is_sync = link.href === '/admin/sync' && !!data.sync}
            <a href={link.href} title={link.label} aria-label={link.label} class={['nav-link', { active: is_active(link.href), compact: link.compact || is_sync }]}>
              {#if is_sync}
                <SyncStatus sync={data.sync} />
              {:else}
                <Icon style="font-size: 1.15rem; flex-shrink: 0" />
                <span class="nav-label">{link.label}</span>
              {/if}
              {#if link.href === '/chat' && chat_store.total_unread > 0}
                <span class="nav-badge">{chat_store.total_unread}</span>
              {/if}
            </a>
          {/each}
        </nav>
        <div class="header-right">
          <User />
        </div>
      </div>
    </header>

    <main class="page-main">
      <!-- optional-chained so svelte-look layout stories (which can't pass snippets) still render -->
      {@render children?.()}
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
    /* More links than house — let the nav scroll on narrow screens instead of
       clipping Sync + the user avatar off the edge. */
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .nav-link {
    flex-shrink: 0;
  }
  .nav-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
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
  /* Dev-tool links are icon-only on desktop (label hidden) to keep the nav tidy. */
  .nav-link.compact {
    padding: 0.25rem 0.4rem;
  }
  .nav-link.compact .nav-label {
    display: none;
  }
  /* Mobile: drop ALL text labels → an icon-only header that fits a phone. */
  @media (max-width: 768px) {
    .header-row {
      gap: 0.6rem;
    }
    .nav-label,
    .brand-label {
      display: none;
    }
    .nav-link {
      padding: 0.25rem 0.4rem;
    }
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
