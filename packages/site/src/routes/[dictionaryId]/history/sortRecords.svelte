<script lang="ts">
  import type { Tables } from '@living-dictionaries/types'
  import { sortedColumn } from './sortedColumnStore'
  import { HistoryFields } from './historyFields'
  import { page } from '$app/stores'

  export let history: Tables<'content_updates'>[] = []

  type SortFields = keyof typeof HistoryFields
  // @ts-ignore
  const historyFields: {
    key: SortFields
    value: HistoryFields
  }[] = Object.entries(HistoryFields).map(([key, value]) => {
    return { key, value }
  })

  let sortKey: SortFields = 'date'
  let sortDescending = true

  $: sortedColumn.set(sortKey)

  $: sortedRecords = history.sort((a, b) => {
    let valueA: string | number
    let valueB: string | number

    // prettier-ignore
    switch (sortKey) {
      case 'entryName':
        valueA = String(a.change.data?.lexeme?.default || 0)
        valueB = String(b.change.data?.lexeme?.default || 0)
        break
      case 'type':
        valueA = String(a.change.type || 0)
        valueB = String(b.change.type || 0)
        break
      case 'date':
        valueA = String(a.timestamp || 0)
        valueB = String(b.timestamp || 0)
        break
      // case 'action':
      //   valueA = getActionValue(a)
      //   valueB = getActionValue(b)
      //   break
      default:
        valueA = a[sortKey] ? JSON.stringify(a[sortKey]).toUpperCase() : 'zz'
        valueB = b[sortKey] ? JSON.stringify(b[sortKey]).toUpperCase() : 'zz'
    }
    return sortDescending ? valueB.localeCompare(valueA) : valueA.localeCompare(valueB)
  })

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
      on:click={() => setSortSettings(field.key)}
      title="Click to sort asc/desc">
      {$page.data.t(`history.${field.value}`)}
      {#if sortKey === field.key}
        {#if sortDescending}
          <i class="fas fa-sort-amount-down" />
        {:else}
          <i class="fas fa-sort-amount-up" />
        {/if}
      {/if}
    </th>
  {/each}
</thead>

<slot {sortedRecords} />

<style>
  th {
    --at-apply: text-xs font-semibold text-gray-600 uppercase tracking-wider;
  }
</style>
