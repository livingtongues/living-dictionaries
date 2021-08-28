<script lang="ts">
  import { browser } from '$app/env';
  export let column;
  export let row;
  import { isManager, isContributor } from '$lib/stores';
</script>

{#if browser}
  {#if row.data.pf}
    <svelte:component
      this={column.imageComponent}
      size={60}
      entry={row.data}
      editable={$isManager || $isContributor} />
  {:else if $isManager || $isContributor}
    <svelte:component this={column.addImageComponent} entry={row.data} class="text-xs" />
  {/if}
{/if}
