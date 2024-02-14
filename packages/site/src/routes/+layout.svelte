<script lang="ts">
  import './global.css';
  import { navigating, page } from '$app/stores';
  import { browser } from '$app/environment';
  import LoadingIndicator from './LoadingIndicator.svelte';

  let hideMessage = false;
</script>

{#if browser && $navigating}
  <LoadingIndicator />
{/if}

<div class:hidden={hideMessage} class="bg-amber-400 pl-4 text-sm">
  <span class="cursor-pointer" on:click={() => hideMessage = true}>&times;</span>
  <strong>Attention:</strong> New dictionary entries are not being displayed correctly at this time. This will be resolved on February 15, 2024. We apologize for the inconvenience.
</div>

<div id="direction" dir={$page.data.t('page.direction')}>
  <slot />
</div>

{#if browser}
  {#await import('./Analytics.svelte') then { default: Analytics }}
    <Analytics />
  {/await}
{/if}
