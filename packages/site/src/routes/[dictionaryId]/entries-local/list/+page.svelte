<script lang="ts">
  import { getContext } from 'svelte';
  import ListEntry from '../../entries/list/ListEntry.svelte';
  import type { Writable } from 'svelte/store';
  import type { ExpandedEntry } from '@living-dictionaries/types';

  export let data;
  $: ({dictionary} = data)

  const entries = getContext<Writable<ExpandedEntry[]>>('entries')
</script>

{#if $entries}
  {#each $entries as entry}
    <ListEntry
      dictionary={$dictionary}
      {entry}
      videoAccess={$dictionary.videoAccess}
      canEdit
      on:deleteImage={() => alert('delete image not implemented yet')} />
  {/each}
{/if}
