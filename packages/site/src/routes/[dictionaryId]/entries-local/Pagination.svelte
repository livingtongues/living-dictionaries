<script lang="ts">
  import PaginationButtons from '$lib/components/search/PaginationButtons.svelte';
  import { page } from '$app/stores';
  import { Button } from 'svelte-pieces';

  export let can_edit = false
  export let page_from_url: number
  export let number_of_pages: number

  function go_to_page(one_based_page: number) {
    page_from_url = one_based_page;
    window.scrollTo({ top: 0 });
  }
</script>

{#if can_edit}
  <Button class="text-nowrap sticky bottom-3 z-10 md:hidden" form="filled" href="./new">
    <span class="i-fa-solid-plus -mt-1" />
    {$page.data.t('entry.add_entry')}
  </Button>
{/if}

<nav class="md:sticky md:bottom-0 bg-white pt-2 pb-1 flex items-center print:hidden">
  <PaginationButtons pages={number_of_pages} current_page={page_from_url || 1} {go_to_page}>
    {#if can_edit}
      <Button class="text-nowrap ml-3 hidden md:block" form="filled" href="./new">
        <span class="i-fa-solid-plus -mt-1" />
        {$page.data.t('entry.add_entry')}
      </Button>
    {/if}
  </PaginationButtons>
</nav>
