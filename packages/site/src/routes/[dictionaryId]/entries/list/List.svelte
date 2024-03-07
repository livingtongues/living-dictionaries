<script lang="ts">
  import type { ActualDatabaseEntry, IDictionary } from '@living-dictionaries/types';
  import ListEntry from './ListEntry.svelte';
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
  import { page } from '$app/stores';

  export let entries: ActualDatabaseEntry[]
  export let dictionary: IDictionary
  export let canEdit = false
</script>

{#each entries as entry (entry.id)}
  <ListEntry {canEdit} {dictionary} entry={convert_and_expand_entry(entry, $page.data.t)} />
{/each}
