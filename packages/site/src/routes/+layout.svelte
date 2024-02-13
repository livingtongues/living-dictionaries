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

<div class:hidden={hideMessage} class="bg-amber-400 pl-4">
  <span class="cursor-pointer" on:click={() => hideMessage = true}>&times;</span>
  <strong>Attention:</strong> our site is temporarily down but will be restored on Feb 14, 2024. Our sincere apologies.
</div>

<div id="direction" dir={$page.data.t('page.direction')}>
  <slot />
</div>

{#if browser}
  {#await import('./Analytics.svelte') then { default: Analytics }}
    <Analytics />
  {/await}
{/if}
