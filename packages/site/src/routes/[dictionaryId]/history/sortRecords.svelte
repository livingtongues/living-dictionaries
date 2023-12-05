<script lang="ts">
  import { page } from '$app/stores';
  import type { Change } from '@living-dictionaries/types';

  export let history: Change[] = [];
  enum HistoryFields {
    entryName = 'entry_name',
    updatedName = 'editor',
    action = 'action',
    field = 'field',
    date = 'date',
  }

  type SortFields = keyof typeof HistoryFields;
  //@ts-ignore
  const historyFields: {
    key: SortFields;
    value: HistoryFields;
  }[] = Object.entries(HistoryFields).map(([key, value]) => {
    return { key, value };
  })

  let sortKey: SortFields = 'date';
  let sortDescending = true;

  $: sortedRecords = history.sort((a, b) => {
    let valueA: string | number;
    let valueB: string | number;
    // prettier-ignore
    switch (sortKey) {
      case 'date':
        valueA = a.updatedAtMs || 0;
        valueB = b.updatedAtMs || 0;
        break;
      case 'action':
        valueA = a.previousValue?.length === 0 ? 3 : 1;
        valueB = b.currentValue?.length === 0 ? 0 : 2;
        break;
      default:
        valueA = a[sortKey] ? a[sortKey].toUpperCase() : 'zz'; // if we ever have missing names or email, then pass 'zz' when the sortKey is undefined
        valueB = b[sortKey] ? b[sortKey].toUpperCase() : 'zz';
    }
    if (valueA < valueB)
      return sortDescending ? -1 : 1;

    if (valueA > valueB)
      return sortDescending ? 1 : -1;

    return 0;
  });

  function setSortSettings(paraSortKey: SortFields) {
    //Changes the key if the sort wasn't based on the button before, and if it was, change the direction
    if (sortKey === paraSortKey)
      sortDescending = !sortDescending;
    else
      sortKey = paraSortKey;
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
