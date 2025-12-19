<script lang="ts">
  import { browser } from '$app/environment'
  import { page } from '$app/stores'

  let { can_edit } = $derived($page.data)

  let { column, row } = $props();
</script>

{#if browser}
  {#if row.data.pf}
    <column.imageComponent size={60} entry={row.data} can_edit={$can_edit} />
  {:else if $can_edit}
    <column.addImageComponent entry={row.data} class="text-xs" />
  {/if}
{/if}
