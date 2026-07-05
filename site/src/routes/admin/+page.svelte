<script lang="ts">
  import type { Component } from 'svelte'
  import IconMdiAccountMultipleOutline from '~icons/mdi/account-multiple-outline'
  import IconMdiAndroid from '~icons/mdi/android'
  import IconMdiApple from '~icons/mdi/apple'
  import IconMdiArrowRight from '~icons/mdi/arrow-right'
  import IconMdiBellRingOutline from '~icons/mdi/bell-ring-outline'
  import IconMdiBookOpenPageVariantOutline from '~icons/mdi/book-open-page-variant-outline'
  import IconMdiChartLine from '~icons/mdi/chart-line'
  import IconMdiCheck from '~icons/mdi/check'
  import IconMdiCloudSync from '~icons/mdi/cloud-sync'
  import IconMdiContentCopy from '~icons/mdi/content-copy'
  import IconMdiForumOutline from '~icons/mdi/forum-outline'
  import IconMdiHeartPulse from '~icons/mdi/heart-pulse'
  import IconMdiImageMultipleOutline from '~icons/mdi/image-multiple-outline'
  import IconMdiMessageTextOutline from '~icons/mdi/message-text-outline'
  import IconMdiMonitor from '~icons/mdi/monitor'
  import IconMdiOpenInNew from '~icons/mdi/open-in-new'
  import IconMdiRobotOutline from '~icons/mdi/robot-outline'
  import IconMdiTableCog from '~icons/mdi/table-cog'
  import IconMdiTranslate from '~icons/mdi/translate'
  import NotifyChannelToggle from '$lib/admin/notify-channel-toggle.svelte'
  import { get_admin } from '$lib/admins'

  let { data } = $props()

  const user = $derived(data.auth_user.user)
  const admin_level = $derived(data.auth_user.admin_level)
  const admin = $derived(get_admin(user?.email))
  const topic = $derived(admin?.ntfy_topic ?? null)
  const ntfy_url = $derived(topic ? `https://ntfy.sh/${topic}` : null)

  let copied = $state(false)
  async function copy_topic() {
    if (!topic)
      return
    try {
      await navigator.clipboard.writeText(topic)
      copied = true
      setTimeout(() => { copied = false }, 1500)
    } catch {
    // clipboard blocked — the topic is selectable on screen as a fallback
    }
  }

  interface NavBox {
    href: string
    title: string
    body: string
    cta: string
    icon: Component
    accent: string
    /** Hide below this admin tier — currently only the dev-facing Analytics/Schema cards. */
    min_level?: number
  }
  const all_boxes: NavBox[] = [
    { href: '/admin/messages', title: 'Messages', body: 'Inbound support & feedback email threads. Reply via SES, assign to an admin, match unknown senders, mark resolved.', cta: 'Open inbox', icon: IconMdiMessageTextOutline, accent: 'var(--primary)' },
    { href: '/admin/users', title: 'Users', body: 'Registered users with their dictionaries, email aliases, thread history, and unsubscribe state.', cta: 'Browse', icon: IconMdiAccountMultipleOutline, accent: 'var(--success)' },
    { href: '/chat', title: 'Chat', body: 'Channels + 1:1 DMs with admins, super managers, and partners — with a phone/email ping when a message is waiting for you.', cta: 'Open chat', icon: IconMdiForumOutline, accent: 'var(--primary)' },
    { href: '/translate', title: 'Translations', body: 'DB-backed interface translations — per-language progress, review flags on AI or changed-English values, and a button to email translators their pending work.', cta: 'Open dashboard', icon: IconMdiTranslate, accent: 'var(--warning)' },
    { href: '/admin/dictionaries', title: 'Dictionaries', body: 'Every dictionary on the platform — visibility, entry counts, partners, and per-dictionary roles.', cta: 'Browse', icon: IconMdiBookOpenPageVariantOutline, accent: 'var(--success)' },
    { href: '/admin/featured-words', title: 'Featured', body: 'Curate the homepage featured-word rotation — pick entries, preview cards, and reorder.', cta: 'Open', icon: IconMdiImageMultipleOutline, accent: 'var(--success)' },
    { href: '/admin/analytics', title: 'Analytics', body: 'Usage — session & navigation activity, top routes and events, geography, agent-API volume, and browser/device mix.', cta: 'Open', icon: IconMdiChartLine, accent: 'var(--primary)', min_level: 3 },
    { href: '/admin/health', title: 'Site health', body: 'Diagnostics — error clusters & rate, server faults, boot health, build/leader-worker health, performance, synthetic uptime, and web vitals.', cta: 'Open', icon: IconMdiHeartPulse, accent: 'var(--danger)', min_level: 3 },
    { href: '/admin/schema', title: 'Schema', body: 'Browse the wa-sqlite + server schema — tables, columns, foreign keys, and the relationship graph.', cta: 'Open', icon: IconMdiTableCog, accent: 'var(--success)', min_level: 3 },
    { href: '/admin/sync', title: 'Sync', body: 'Live sync-engine dashboard — cursors, watermarks, dirty rows, and per-table push / pull history.', cta: 'Open', icon: IconMdiCloudSync, accent: 'var(--warning)' },
    { href: '/admin/api-docs', title: 'Agent API', body: 'A human-readable view of the live /api/v1/openapi.json spec — exactly what agents read to self-configure their reads & writes.', cta: 'Open', icon: IconMdiRobotOutline, accent: 'var(--primary)' },
  ]
  const boxes = $derived(all_boxes.filter(box => !box.min_level || admin_level >= box.min_level))

  interface DeviceStep {
    title: string
    icon: Component
    body: string
    href: string
    link_label: string
  }
  const device_steps: DeviceStep[] = [
    { title: 'iPhone / iPad', icon: IconMdiApple, body: 'Install ntfy from the App Store, tap +, choose “Subscribe to topic”, keep the server as ntfy.sh, and paste your topic.', href: 'https://apps.apple.com/app/ntfy/id1625396347', link_label: 'App Store' },
    { title: 'Android', icon: IconMdiAndroid, body: 'Install ntfy from Google Play or F-Droid, tap +, “Subscribe to topic”, keep ntfy.sh, and paste your topic.', href: 'https://play.google.com/store/apps/details?id=io.heckel.ntfy', link_label: 'Google Play' },
    { title: 'Desktop / browser', icon: IconMdiMonitor, body: 'Open your topic link below, click “Allow notifications”, and keep the tab (or install it as a PWA) for desktop pushes.', href: 'https://ntfy.sh/app', link_label: 'ntfy web app' },
  ]
</script>

<svelte:head><title>Admin · Living Dictionaries</title></svelte:head>

<div class="root">
  <header class="header">
    <h1 class="page-title">Admin</h1>
    <p class="subtitle">Internal tools for support, users, dictionaries, and data. Visible only to admin accounts.</p>
  </header>

  <div class="grid">
    {#each boxes as box (box.href)}
      {@const Icon = box.icon}
      <a class="box" style="--accent: {box.accent}" href={box.href}>
        <Icon class="box-icon" style="color: var(--accent)" />
        <span class="box-title">{box.title}</span>
        <span class="box-body">{box.body}</span>
        <span class="box-cta" style="color: var(--accent)">
          {box.cta}
          <IconMdiArrowRight class="cta-arrow" />
        </span>
      </a>
    {/each}
  </div>

  <section class="hero">
    <div class="hero-head">
      <IconMdiBellRingOutline class="hero-icon" />
      <div>
        <h2 class="hero-title">Your phone notifications</h2>
        <p class="hero-sub">
          Get an instant push the moment a thread is assigned to you or an admin messages you —
          even when the admin isn't open. Pushes ride on
          <a href="https://ntfy.sh" target="_blank" rel="noreferrer">ntfy.sh</a>, a free open-source
          notification service. Subscribe once on each device.
        </p>
      </div>
    </div>

    {#if user}
      <NotifyChannelToggle db={data.db} sync={data.sync} user_id={user.id} />
    {/if}

    {#if topic}
      <div class="topic-block">
        <span class="topic-label">Your private topic</span>
        <div class="topic-row">
          <code class="topic-code">{topic}</code>
          <button type="button" class="btn btn-default topic-btn" onclick={copy_topic}>
            {#if copied}
              <IconMdiCheck style="color: var(--success)" /> Copied
            {:else}
              <IconMdiContentCopy /> Copy
            {/if}
          </button>
          <a class="btn btn-primary btn-default topic-btn" href={ntfy_url} target="_blank" rel="noreferrer">
            <IconMdiOpenInNew /> Open in ntfy web
          </a>
        </div>
        <p class="topic-note">
          This topic is the only thing securing your pushes — treat it like a password and don't share it.
        </p>
      </div>

      <div class="device-grid">
        {#each device_steps as step (step.title)}
          {@const Icon = step.icon}
          <div class="device-card">
            <div class="device-head">
              <Icon class="device-icon" />
              <span class="device-title">{step.title}</span>
            </div>
            <p class="device-body">{step.body}</p>
            <a class="device-link" href={step.href} target="_blank" rel="noreferrer">
              {step.link_label}
              <IconMdiOpenInNew style="font-size: 0.9em" />
            </a>
          </div>
        {/each}
      </div>
    {:else}
      <p class="topic-note">No ntfy topic is configured for this account yet — ask Jacob to set one up.</p>
    {/if}
  </section>
</div>

<style>
  .root {
    width: 100%;
    max-width: 1250px;
    margin: 0 auto;
    padding: 0.75rem;
  }

  .header {
    margin-bottom: 1rem;
  }
  .page-title {
    font-size: 1.5rem;
    font-weight: 600;
  }
  .subtitle {
    font-size: 0.875rem;
    color: var(--color-secondary);
    margin-top: 0.25rem;
  }

  /* Notification hero */
  .hero {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin-top: 1.5rem;
  }
  .hero-head {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }
  :global(.hero-icon) {
    font-size: 2rem;
    color: var(--primary);
    flex-shrink: 0;
    margin-top: 0.125rem;
  }
  .hero-title {
    font-size: 1.125rem;
    font-weight: 600;
  }
  .hero-sub {
    font-size: 0.875rem;
    color: var(--color-secondary);
    margin-top: 0.25rem;
  }
  .hero-sub a {
    color: var(--primary);
  }

  .topic-block {
    margin-top: 1.25rem;
  }
  .topic-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-secondary);
    margin-bottom: 0.375rem;
  }
  .topic-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .topic-code {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    background: var(--background);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    padding: 0.375rem 0.625rem;
    user-select: all;
  }
  .topic-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }
  .topic-note {
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin-top: 0.5rem;
  }

  .device-grid {
    display: grid;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }
  @media (min-width: 640px) {
    .device-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  .device-card {
    background: var(--background);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 0.875rem 1rem;
  }
  .device-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  :global(.device-icon) {
    font-size: 1.25rem;
    color: var(--color-secondary);
  }
  .device-title {
    font-weight: 600;
    font-size: 0.9rem;
  }
  .device-body {
    font-size: 0.8rem;
    color: var(--color-secondary);
    margin: 0.5rem 0;
    line-height: 1.45;
  }
  .device-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--primary);
    text-decoration: none;
  }
  .device-link:hover {
    text-decoration: underline;
  }

  /* Nav boxes */
  .grid {
    display: grid;
    gap: 1rem;
  }
  @media (min-width: 640px) {
    .grid {
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    }
  }
  .box {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-radius: 0.5rem;
    width: 100%;
    height: 100%;
    border: 2px solid transparent;
    text-decoration: none;
    color: inherit;
  }
  .box:hover {
    border-color: var(--accent);
  }
  :global(.box-icon) {
    font-size: 200%;
    display: block;
    margin-bottom: 0.25rem;
  }
  .box-title {
    font-size: 1.125rem;
    font-weight: 600;
  }
  .box-body {
    font-size: 0.875rem;
    color: var(--color-secondary);
    margin: 0.25rem 0;
  }
  .box-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    align-self: flex-start;
    font-size: 0.875rem;
    font-weight: 600;
  }
  :global(.cta-arrow) {
    transition: transform 600ms;
  }
  .box:hover :global(.cta-arrow) {
    transform: translateX(0.25rem);
  }
</style>
