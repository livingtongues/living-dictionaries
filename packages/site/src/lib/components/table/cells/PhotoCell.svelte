<script lang="ts">
  import { browser } from '$app/env';
  export let column;
  export let row;
  import { canEdit } from '$lib/stores';
</script>

{#if browser}
  {#if row.data.pf}
    <svelte:component this={column.imageComponent} size={60} entry={row.data} canEdit={$canEdit} />
  {:else if $canEdit}
    <svelte:component this={column.addImageComponent} entry={row.data} class="text-xs" />
  {/if}
{/if}
