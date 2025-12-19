<script lang="ts">
  import { run } from 'svelte/legacy';

  import PaginationButtons from './PaginationButtons.svelte'
  import type { DbOperations } from '$lib/dbOperations'

  interface Props {
    add_entry: DbOperations['insert_entry'];
    can_edit?: boolean;
    page_from_url: number;
    number_of_pages: number;
  }

  let {
    add_entry,
    can_edit = false,
    page_from_url = $bindable(),
    number_of_pages
  }: Props = $props();

  function go_to_page(one_based_page: number) {
    page_from_url = one_based_page
    window.scrollTo({ top: 0 })
  }

  run(() => {
    if (page_from_url === 1)
      page_from_url = null
  });
</script>

{#if can_edit}
  {#await import('./AddEntry.svelte') then { default: AddEntry }}
    <AddEntry {add_entry} class="text-nowrap sticky bottom-3 z-10 !md:hidden !print:hidden" />
  {/await}
{/if}

<nav class="md:sticky md:bottom-0 bg-white pt-2 pb-1 flex items-center print:hidden">
  <PaginationButtons pages={number_of_pages} current_page={page_from_url || 1} {go_to_page}>
    {#if can_edit}
      <div class="w-3 mr-auto"></div>
      {#await import('./AddEntry.svelte') then { default: AddEntry }}
        <AddEntry {add_entry} class="text-nowrap hidden md:block" />
      {/await}
    {/if}
  </PaginationButtons>
</nav>
