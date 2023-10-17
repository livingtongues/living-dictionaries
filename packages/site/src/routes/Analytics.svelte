<script lang="ts">
  import { page } from '$app/stores';

  const analyticsId = import.meta.env.VERCEL_ANALYTICS_ID as string;
  console.info({analyticsId})

</script>

{#if $page.url.host.includes('livingdictionaries.app')}
  {#await import('$lib/components/shell/LogRocket.svelte') then { default: LogRocket }}
    <LogRocket />
  {/await}
{/if}
