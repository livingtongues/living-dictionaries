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
  import { navigating, page, updated } from '$app/state'
  import { browser } from '$app/environment'
  import { init_remote_logging } from '$lib/debug/remote-log'
  import { toast } from '$lib/svelte-pieces/toast.svelte'

  interface Props {
    children?: import('svelte').Snippet
  }

  const { children }: Props = $props()

  onMount(() => {
    init_remote_logging()
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
