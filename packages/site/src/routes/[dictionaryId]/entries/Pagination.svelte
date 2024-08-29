<script lang="ts">
  import PaginationButtons from '$lib/components/search/PaginationButtons.svelte'
  import type { DbOperations } from '$lib/dbOperations'

  export let addNewEntry: DbOperations['addNewEntry']
  export let can_edit = false
  export let page_from_url: number
  export let number_of_pages: number

  function go_to_page(one_based_page: number) {
    page_from_url = one_based_page
    window.scrollTo({ top: 0 })
  }

  $: if (page_from_url === 1)
    page_from_url = null
</script>

{#if can_edit}
  {#await import('$lib/components/search/AddEntry.svelte') then { default: AddEntry }}
    <AddEntry {addNewEntry} class="text-nowrap sticky bottom-3 z-10 md:hidden print:hidden" />
  {/await}
{/if}

<nav class="md:sticky md:bottom-0 bg-white pt-2 pb-1 flex items-center print:hidden">
  <PaginationButtons pages={number_of_pages} current_page={page_from_url || 1} {go_to_page}>
    {#if can_edit}
      <div class="w-3 mr-auto" />
      {#await import('$lib/components/search/AddEntry.svelte') then { default: AddEntry }}
        <AddEntry {addNewEntry} class="text-nowrap hidden md:block" />
      {/await}
    {/if}
  </PaginationButtons>
</nav>
