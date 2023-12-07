<script lang="ts">
  import { page } from '$app/stores';
  import { getActionValue } from './getActionValue';
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
    const getValue = (record: Change, key: SortFields) => record[key] ? record[key].toUpperCase() : 'zz';
    let valueA: string | number;
    let valueB: string | number;

    // prettier-ignore
    switch (sortKey) {
      case 'date':
        valueA = String(a.updatedAtMs || 0);
        valueB = String(b.updatedAtMs || 0);
        break;
      case 'action':
        valueA = getActionValue(a);
        valueB = getActionValue(b);
        break;
      default:
        valueA = String(getValue(a, sortKey));
        valueB = String(getValue(b, sortKey));
    }
    return sortDescending ? valueB.localeCompare(valueA) : valueA.localeCompare(valueB);
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
