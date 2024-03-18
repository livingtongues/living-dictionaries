<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';

  export let column;
  export let row;
</script>

{#if browser}
  {#if row.data.pf}
    <svelte:component this={column.imageComponent} size={60} entry={row.data} canEdit={$page.data.can_edit} />
  {:else if $page.data.can_edit}
    <svelte:component this={column.addImageComponent} entry={row.data} class="text-xs" />
  {/if}
{/if}
