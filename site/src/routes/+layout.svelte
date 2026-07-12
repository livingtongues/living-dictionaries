<script lang="ts">
  import './reset.css'
  import '$lib/typography.css'
  import '$lib/theme.css'
  import '$lib/buttons.css'
  import '$lib/forms.css'
  import './global.css'
  import LoadingIndicator from './LoadingIndicator.svelte'
  import DictBootProgress from './DictBootProgress.svelte'
  import { dict_boot_progress } from '$lib/db/dict-client/dict-boot-progress.svelte'
  import Toasts from '$lib/components/ui/Toasts.svelte'
  import ViewAsBanner from '$lib/components/shell/ViewAsBanner.svelte'
  import { onMount } from 'svelte'
  import { afterNavigate, beforeNavigate } from '$app/navigation'
  import { navigating, page, updated } from '$app/state'
  import { browser } from '$app/environment'
  import { init_remote_logging, log_event, log_navigation } from '$lib/debug/remote-log'
  import { init_web_vitals, report_initial_load_when_ready } from '$lib/debug/perf'
  import { set_missing_translation_handler } from '$lib/i18n'
  import { toast } from '$lib/state/toast.svelte'
  import { init_color_scheme } from '$lib/state/dark-mode'
  import { init_pwa_install } from '$lib/state/pwa-install.svelte'
  import { chat_store } from '$lib/chat/chat-store.svelte'

  interface Props {
    children?: import('svelte').Snippet
  }

  const { children }: Props = $props()

  // Footer belongs on informational pages, not the app-workspace pages. Hidden on
  // dictionary/entry pages (where a bottom bar is in the way), admin, chat,
  // translate, and the tile-map dev tool. Unknown routes (404) default to showing.
  const footer_hidden_prefixes = ['/[dictionaryId]', '/admin', '/chat', '/translate', '/tile-map']
  const show_footer = $derived(!footer_hidden_prefixes.some(prefix => page.route.id?.startsWith(prefix)))
  // The dictionaries list fills the viewport exactly so its table scrolls
  // internally with no page scrollbar; other footer pages scroll normally.
  const fit_viewport = $derived(page.route.id === '/dictionaries')

  onMount(() => {
    init_color_scheme()
    init_pwa_install()
    init_remote_logging()
    // Ship genuinely-missing i18n keys (no English base) to client_logs as an
    // actionable `warn`. i18n already console.warns for dev, so this only ships —
    // log_event (not log_warning) avoids a duplicate console line. Deduped per
    // unique key inside i18n.
    set_missing_translation_handler(({ key, locale, fallback }) =>
      log_event({ level: 'warn', message: `i18n missing key: ${key}`, context: { i18n_key: key, locale, fallback: fallback ?? null } }))
    init_web_vitals()
    report_initial_load_when_ready()
  })

  // Chat members get the app-wide unread poll (avatar dot + UserMenu badge).
  // No presence heartbeat here — that only runs on /chat and inside /admin, so
  // members browsing the rest of the site still receive external pings.
  $effect(() => {
    if (browser && page.data.auth_user?.is_chat_member)
      chat_store.start_rooms_poll()
  })

  // Wall-clock start of a client-side navigation; afterNavigate reads it back to
  // compute perceived nav duration. Reset after each measure so a cancelled nav
  // can't leak a stale start into the next one.
  let nav_started_at = 0
  beforeNavigate(() => {
    nav_started_at = performance.now()
  })

  // Feeds route history into client_logs (`navigation` events) and the breadcrumb
  // trail attached to every error. Folds nav duration into the same event.
  afterNavigate((nav) => {
    try {
      const to_path = nav?.to?.url?.pathname ?? null
      const from_path = nav?.from?.url?.pathname ?? null
      if (!to_path)
        return
      const duration_ms = nav_started_at ? performance.now() - nav_started_at : null
      nav_started_at = 0
      log_navigation({ to: to_path, from: from_path, duration_ms })
    } catch {
    // Never let logging break navigation.
    }
  })

  // When the version poll (kit.version.pollInterval) detects a new deploy,
  // `updated.current` flips true and stays true. Show a single persistent,
  // non-blocking toast offering a reload — never force it, so an in-progress
  // edit is never nuked out from under the user.
  let update_prompt_shown = false
  $effect(() => {
    if (!browser || !updated.current || update_prompt_shown)
      return
    update_prompt_shown = true
    toast('A new version of the site is available.', {
      action: { label: 'Reload', callback: () => location.reload() },
      dismiss_label: 'Later',
    })
  })
</script>

{#if browser}
  <!-- Real byte-level dict-boot download bar takes precedence over the generic
       faux-progress nav indicator while a cold dictionary snapshot downloads. -->
  {#if navigating?.to && !dict_boot_progress.active}
    <LoadingIndicator />
  {/if}
  <DictBootProgress />
{/if}

<Toasts />
<ViewAsBanner />

<div
  id="direction"
  dir={page.data.t('page.direction') as 'ltr' | 'rtl' | 'auto'}
  class:footer-layout={show_footer}
  class:fit={fit_viewport}>
  {#if show_footer}
    <div class="footer-layout-main">
      {@render children?.()}
    </div>
    {#await import('$lib/components/shell/Footer.svelte') then { default: Footer }}
      <Footer />
    {/await}
  {:else}
    {@render children?.()}
  {/if}
</div>

<style>
  .footer-layout {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }

  .footer-layout-main {
    flex: 1 0 auto;
  }

  /* Fit-to-viewport pages (dictionaries list): the shell is exactly the viewport
     so the inner table scrolls on its own and the page itself never scrolls. */
  .footer-layout.fit {
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
  }

  .footer-layout.fit .footer-layout-main {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
</style>
