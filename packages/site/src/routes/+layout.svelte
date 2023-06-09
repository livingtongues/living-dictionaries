<script lang="ts">
  import './global.css';
  import { navigating } from '$app/stores';
  import { browser } from '$app/environment';
  import { t } from 'svelte-i18n';
  import LoadingIndicator from './LoadingIndicator.svelte';
</script>

{#if $navigating}
  <LoadingIndicator />
{/if}

<div id="direction" dir={$t('direction')}>
  <slot />
</div>

{#if browser}
  {#await import('./Analytics.svelte') then { default: Analytics }}
    <Analytics />
  {/await}
{/if}
