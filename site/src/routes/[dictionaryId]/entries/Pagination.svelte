<script lang="ts">
  import type { Snippet } from 'svelte'
  import PaginationButtons from './PaginationButtons.svelte'

  interface Props {
    /** Scope-adaptive add button (Add entry / Add sentence / …), given the placement class to render with. */
    add_button?: Snippet<[string]>
    can_edit?: boolean
    page_from_url: number
    number_of_pages: number
  }

  let {
    add_button,
    can_edit = false,
    page_from_url = $bindable(),
    number_of_pages,
  }: Props = $props()

  function go_to_page(one_based_page: number) {
    page_from_url = one_based_page
    window.scrollTo({ top: 0 })
  }

  $effect(() => {
    if (page_from_url === 1)
      page_from_url = null
  })
</script>

{#if can_edit && add_button}
  {@render add_button('add-entry-floating')}
{/if}

<nav>
  <PaginationButtons pages={number_of_pages} current_page={page_from_url || 1} {go_to_page}>
    {#if can_edit && add_button}
      <div style="width: 0.75rem; margin-right: auto"></div>
      {@render add_button('add-entry-inline')}
    {/if}
  </PaginationButtons>
</nav>

<style>
  /* AddEntry renders these classes on its own root (no wrapper here to scope under) */
  :global(.add-entry-floating) {
    text-wrap: nowrap;
    position: sticky;
    bottom: 0.75rem;
    z-index: 10;
  }

  :global(.add-entry-inline) {
    text-wrap: nowrap;
    display: none;
  }

  nav {
    background-color: var(--background);
    padding-top: 0.5rem;
    padding-bottom: 0.25rem;
    display: flex;
    align-items: center;
  }

  @media (min-width: 768px) {
    nav {
      position: sticky;
      bottom: 0;
    }

    :global(.add-entry-floating) {
      display: none !important;
    }

    :global(.add-entry-inline) {
      display: block;
    }
  }

  @media print {
    nav,
    :global(.add-entry-floating) {
      display: none !important;
    }
  }
</style>
