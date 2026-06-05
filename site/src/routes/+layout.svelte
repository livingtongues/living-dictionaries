<!-- @migration task: review uses of `navigating` -->
<script lang="ts">
  import './reset.css'
  import 'virtual:uno.css'
  import '$lib/theme.css'
  import '$lib/buttons.css'
  import './global.css'
  import LoadingIndicator from './LoadingIndicator.svelte'
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

  {#await import('$lib/components/ui/Toasts.svelte') then { default: Toasts }}
    <Toasts />
  {/await}
{/if}

<!-- {#if $user}
  {#await import('./Banner.svelte') then { default: Banner }}
    <Banner />
  {/await}
{/if} -->

<div id="direction" dir={page.data.t('page.direction') as 'ltr' | 'rtl' | 'auto'}>
  {@render children?.()}
</div>
