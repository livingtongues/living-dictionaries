<script lang="ts">
  import { _ } from 'svelte-i18n';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import type { IEntry } from '@living-dictionaries/types';
  import type { InstantSearch } from 'instantsearch.js'
  export let entry: IEntry,
    canEdit = false,
    search: InstantSearch;
  let value = entry.di;
</script>

{#if value || canEdit}
  <ShowHide let:show let:set let:toggle>
    <div
      class="md:px-2 rounded"
      on:click={() => set(canEdit)}
      class:hover:bg-gray-100={canEdit}
      class:cursor-pointer={canEdit}
      class:order-2={!value}>
      <div class="text-xs text-gray-500 mt-1">{$_('entry.di', { default: 'Dialect' })}</div>
      <div class="border-b-2 border-dashed pb-1 mb-2">
        {#if value}
          <div dir="ltr">
            {value}
          </div>
        {:else}<i class="far fa-pencil text-gray-500 text-sm" />{/if}
      </div>
    </div>
    {#if show}
      {#await import('$lib/components/modals/DialectModal.svelte') then DialectModal}
        <DialectModal.default
          t={_}
          {search}
          attribute="di"
          on:valueupdate
          {entry}
          on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>
{/if}