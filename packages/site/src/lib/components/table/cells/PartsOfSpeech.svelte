<script lang="ts">
  import { _ } from 'svelte-i18n';

  import type { IEntry } from '@living-dictionaries/types';
  export let entry: IEntry,
    canEdit = false;

  let edit = false;
</script>

<div
  class:cursor-pointer={canEdit}
  class="h-full"
  style="padding: 0.1em 0.25em"
  on:click={() => (edit = canEdit)}>
  {#if entry.ps && typeof(entry.ps) === 'string'}
    {$_('ps.' + entry.ps, { default: entry.ps })}
  {:else if entry.ps && entry.ps.length && typeof(entry.ps) !== 'string'}
    {#each entry.ps as pos, i}
      {$_('ps.' + pos, { default: pos })}{#if i != entry.ps.length - 1}
        <span class="mr-1">,</span>
      {/if}
    {/each}
  {/if}
</div>

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