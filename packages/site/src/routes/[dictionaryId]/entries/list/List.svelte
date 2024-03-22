<script lang="ts">
  import type { ActualDatabaseEntry, IDictionary } from '@living-dictionaries/types';
  import ListEntry from './ListEntry.svelte';
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
  import { page } from '$app/stores';
  import type { DbOperations } from '$lib/dbOperations';

  export let entries: ActualDatabaseEntry[]
  export let dictionary: IDictionary
  export let can_edit: boolean
  export let dbOperations: DbOperations
</script>

{#each entries as entry (entry.id)}
  <ListEntry {can_edit} {dictionary} entry={convert_and_expand_entry(entry, $page.data.t)} {dbOperations} />
{/each}
