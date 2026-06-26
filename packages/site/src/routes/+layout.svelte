<script lang="ts">
  import './global.css'
  import LoadingIndicator from './LoadingIndicator.svelte'
  import { navigating, page } from '$app/stores'
  import { browser } from '$app/environment'

// export let data
  // $: ({ user } = data)
</script>

{#if browser}
  {#if $navigating}
    <LoadingIndicator />
  {/if}

  {#await import('./PromptReloadOnUpdate.svelte') then { default: PromptReloadOnUpdate }}
    <PromptReloadOnUpdate />
  {/await}

  {#await import('$lib/components/ui/Toasts.svelte') then { default: Toasts }}
    <Toasts />
  {/await}
{/if}

<!-- {#if $user}
  {#await import('./Banner.svelte') then { default: Banner }}
    <Banner />
  {/await}
{/if} -->

<div id="direction" dir={$page.data.t('page.direction')}>
  <slot />
</div>

{#if browser}
  {#await import('./Analytics.svelte') then { default: Analytics }}
    <Analytics />
  {/await}
{/if}
