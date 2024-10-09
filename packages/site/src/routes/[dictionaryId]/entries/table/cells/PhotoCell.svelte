<script lang="ts">
  import { browser } from '$app/environment'
  import { page } from '$app/stores'

  $: ({ can_edit } = $page.data)

  export let column
  export let row
</script>

{#if browser}
  {#if row.data.pf}
    <svelte:component this={column.imageComponent} size={60} entry={row.data} can_edit={$can_edit} />
  {:else if $can_edit}
    <svelte:component this={column.addImageComponent} entry={row.data} class="text-xs" />
  {/if}
{/if}
