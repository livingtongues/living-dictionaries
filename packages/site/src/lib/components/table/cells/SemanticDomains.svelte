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
  {#if entry.sdn && entry.sdn.length}
    {#each entry.sdn as domain, i}
      {$_('sd.' + domain, { default: domain })}{#if i != entry.sdn.length - 1}
        <span class="mr-1">,</span>
      {/if}
    {/each}
  {/if}
  {#if entry.sdn && entry.sdn.length && entry.sd}|{/if}
  {#if entry.sd}<i class="mr-1">{entry.sd}</i>{/if}
  &nbsp;
</div>

{#if edit}
  {#await import('$lib/components/entry/SemanticDomainsModal.svelte') then { default: SemanticDomainsModal }}
    <SemanticDomainsModal
      {entry}
      on:valueupdate
      on:close={() => {
        edit = false;
      }} />
  {/await}
{/if}
