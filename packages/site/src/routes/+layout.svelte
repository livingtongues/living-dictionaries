<script lang="ts">
  import './global.css';
  import { navigating, page } from '$app/stores';
  import { browser } from '$app/environment';
  import LoadingIndicator from './LoadingIndicator.svelte';
</script>

{#if browser}
  {#if $navigating}
    <LoadingIndicator />
  {/if}
{/if}

<div id="direction" dir={$page.data.t('page.direction')}>
  <slot />
</div>

{#if browser}
  {#await import('./Analytics.svelte') then { default: Analytics }}
    <Analytics />
  {/await}
{/if}
