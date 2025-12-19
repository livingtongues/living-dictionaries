<script lang="ts">
  import type { EntryData, Tables } from '@living-dictionaries/types'
  import { sortedColumn } from './sortedColumnStore'
  import { HistoryFields } from './historyFields'
  import { page } from '$app/state'

  interface Props {
    history?: Tables<'content_updates'>[];
    get_entry: (record: Tables<'content_updates'>) => EntryData;
    children?: import('svelte').Snippet<[any]>;
  }

  let { history = [], get_entry, children }: Props = $props();

  type SortFields = keyof typeof HistoryFields
  // @ts-ignore
  const historyFields: {
    key: SortFields
    value: HistoryFields
  }[] = Object.entries(HistoryFields).map(([key, value]) => {
    return { key, value }
  })

  let sortKey: SortFields = $state('date')
  let sortDescending = $state(true)

  $effect(() => {
    sortedColumn.set(sortKey)
  });

  let sortedRecords = $derived(history.sort((a, b) => {
    let valueA: string | number
    let valueB: string | number

    // prettier-ignore
    switch (sortKey) {
      case 'entryName':
        valueA = String(get_entry(a) || 'zz')
        valueB = String(get_entry(b) || 'zz')
        break
      case 'type':
        valueA = String(a.change.type || 0)
        valueB = String(b.change.type || 0)
        break
      case 'date':
        valueA = String(a.timestamp || 0)
        valueB = String(b.timestamp || 0)
        break
      default:
        valueA = a[sortKey] ? JSON.stringify(a[sortKey]).toUpperCase() : 'zz'
        valueB = b[sortKey] ? JSON.stringify(b[sortKey]).toUpperCase() : 'zz'
    }
    return sortDescending ? valueB.localeCompare(valueA) : valueA.localeCompare(valueB)
  }))

  function setSortSettings(paraSortKey: SortFields) {
    // Changes the key if the sort wasn't based on the button before, and if it was, change the direction
    if (sortKey === paraSortKey)
      sortDescending = !sortDescending
    else
      sortKey = paraSortKey
  }
</script>

<thead>
  {#each historyFields as field}
    <th
      class="cursor-pointer"
      onclick={() => setSortSettings(field.key)}
      title="Click to sort asc/desc">
      {page.data.t(`history.${field.value}`)}
      {#if sortKey === field.key}
        {#if sortDescending}
          <i class="fas fa-sort-amount-down"></i>
        {:else}
          <i class="fas fa-sort-amount-up"></i>
        {/if}
      {/if}
    </th>
  {/each}
</thead>

{@render children?.({ sortedRecords, })}

<style>
  th {
    @apply text-xs font-semibold text-gray-600 uppercase tracking-wider;
  }
</style>
