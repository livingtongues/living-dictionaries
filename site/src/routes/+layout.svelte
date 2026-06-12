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
  import { navigating, page } from '$app/state'
  import { browser } from '$app/environment'
  import { init_remote_logging } from '$lib/debug/remote-log'

  interface Props {
    children?: import('svelte').Snippet
  }

  const { children }: Props = $props()

  onMount(() => {
    init_remote_logging()
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
