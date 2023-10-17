<script lang="ts">
  import { page } from '$app/stores';
</script>

{#if $page.url.host.includes('livingdictionaries.app')}
  {#await import('$lib/components/shell/LogRocket.svelte') then { default: LogRocket }}
    <LogRocket />
  {/await}
{/if}
