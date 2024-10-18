<script lang="ts">
  import './global.css'
  import LoadingIndicator from './LoadingIndicator.svelte'
  import Banner from './Banner.svelte'
  import { navigating, page } from '$app/stores'
  import { browser } from '$app/environment'
</script>

{#if browser}
  {#if $navigating}
    <LoadingIndicator />
  {/if}
{/if}

<Banner />

<div id="direction" dir={$page.data.t('page.direction')}>
  <slot />
</div>

{#if browser}
  {#await import('./Analytics.svelte') then { default: Analytics }}
    <Analytics />
  {/await}
{/if}
