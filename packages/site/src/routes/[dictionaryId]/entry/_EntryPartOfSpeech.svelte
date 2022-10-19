<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IEntry } from '@living-dictionaries/types';
  export let entry: IEntry,
    canEdit = false;
  let edit = false;

  $: hasValue = Boolean((entry.ps) || entry.ps);
</script>

{#if hasValue || canEdit}
  <div
    class:hover:bg-gray-100={canEdit}
    class:cursor-pointer={canEdit}
    class:order-2={!hasValue}
    class="md:px-2 rounded"
    on:click={() => (edit = canEdit)}>
    <div class="text-xs text-gray-500 my-1">
      {$_('entry.ps', { default: 'Part of Speech' })}
    </div>
    <div class="flex flex-wrap whitespace-nowrap border-b-2 border-dashed mb-2">
      {#if entry.ps && !entry.ps.length}
        <span class="px-2 py-1 leading-tight text-xs bg-blue-100 rounded mb-1">
          <i>{entry.ps}</i>
        </span>
        <div class="w-1" />
      {/if}
      {#if entry.ps && entry.ps.length}
        {#each entry.ps as pos}
          <span class="px-2 py-1 leading-tight text-xs bg-blue-100 rounded mb-1">
            {$_('ps.' + pos, { default: pos })}
          </span>
          <div class="w-1" />
        {/each}
      {/if}
      {#if !hasValue || !entry.ps.length}
        <i class="far fa-pencil text-gray-500 text-sm mb-2" />
      {/if}
    </div>
  </div>
{/if}

{#if edit}
  {#await import('$lib/components/modals/POSModal.svelte') then POSModal}
    <POSModal.default
      on:valueupdate
      {entry}
      on:close={() => {
        edit = false;
      }} />
  {/await}
{/if}