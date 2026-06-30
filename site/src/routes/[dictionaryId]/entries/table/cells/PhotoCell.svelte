<script lang="ts">
  import { browser } from '$app/environment'
  import { page } from '$app/state'

  const { can_edit } = $derived(page.data)

  const { column, row } = $props()
</script>

{#if browser}
  {#if row.data.pf}
    <column.imageComponent size={60} entry={row.data} can_edit={can_edit} />
  {:else if can_edit}
    <column.addImageComponent entry={row.data} class="photo-cell-add" />
  {/if}
{/if}

<style>
  /* lands on the add-image component's root (no wrapper here to scope under) */
  :global(.photo-cell-add) {
    font-size: 0.75rem;
    line-height: 1rem;
  }
</style>
