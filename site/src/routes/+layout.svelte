<script lang="ts">
  import './reset.css'
  import '$lib/uno-preflights.css'
  import '$lib/typography.css'
  import '$lib/theme.css'
  import '$lib/buttons.css'
  import '$lib/forms.css'
  import '$lib/icons.css'
  import './global.css'
  import LoadingIndicator from './LoadingIndicator.svelte'
  import Toasts from '$lib/svelte-pieces/Toasts.svelte'
  import ViewAsBanner from '$lib/components/shell/ViewAsBanner.svelte'
  import { onMount } from 'svelte'
  import { afterNavigate, beforeNavigate } from '$app/navigation'
  import { navigating, page, updated } from '$app/state'
  import { browser } from '$app/environment'
  import { init_remote_logging, log_event, log_navigation } from '$lib/debug/remote-log'
  import { init_web_vitals, report_initial_load_when_ready } from '$lib/debug/perf'
  import { set_missing_translation_handler } from '$lib/i18n'
  import { toast } from '$lib/svelte-pieces/toast.svelte'

  interface Props {
    children?: import('svelte').Snippet
  }

  const { children }: Props = $props()

  onMount(() => {
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
  {#if navigating?.to}
    <LoadingIndicator />
  {/if}
{/if}

<Toasts />
<ViewAsBanner />

<div id="direction" dir={page.data.t('page.direction') as 'ltr' | 'rtl' | 'auto'}>
  {@render children?.()}
</div>
