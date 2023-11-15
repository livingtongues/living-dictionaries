<script lang="ts">
  // import { page } from '$app/stores';
  import { canEdit } from '$lib/stores';
  import RecordsBlock from './RecordsBlock.svelte';
  // import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';

  export let data;
  interface monthAndYear {
    month: number;
    year: number;
  }
  let dates: monthAndYear[];
  let editors: string[];
  let entries: string[];
  let fields: string[];
  let selected: 'date' | 'action' | 'editor' | 'lexeme' | 'field' = 'date';
  const options = [
    'date',
    'action',
    'editor',
    'lexeme',
    'field'
  ];

  function sortByDates() {
    const reducedDates = data.history.reduce((acc, record) => {
      const date = new Date(record.updatedAtMs);
      const month = date.getMonth();
      const year = date.getFullYear();
      const key = `${month}-${year}`;

      if (!acc.has(key))
        acc.set(key, {month, year});

      return acc;
    }, new Map());

    dates = Array.from(reducedDates.values());
  }

  function sortBy(field: string) {
    const reducedElements = data.history.reduce((acc, record) => {
      if (!acc.has(record[field]))
        acc.set(record[field], record[field]);

      return acc;
    }, new Map());

    return Array.from(reducedElements.values());
  }

  $: if (data.history.length > 0 ) {
    if ( selected === 'date')
      sortByDates();
    else if (selected === 'editor')
      editors = sortBy('updatedBy');
    else if (selected === 'lexeme')
      entries = sortBy('entryId')
    else if (selected === 'field')
      fields = sortBy('field')
  }
</script>

<div>
  <h3 class="text-xl font-semibold mb-3">
    History <!-- TODO {$page.data.t('dictionary.history')} -->
  </h3>

  <div class="flex justify-end m-3">
    <label for="value-select">Sort by:</label>

    <select bind:value={selected}>
      {#each options as value}
        <option {value}>{value[0].toUpperCase() + value.slice(1)}</option>
      {/each}
    </select>
  </div>

  {#if canEdit}
    {#if data.history?.length > 0}
      {#if selected === 'date'}
        {#each dates as date}
          <RecordsBlock {selected} records={data.history.filter(record => new Date(record.updatedAtMs).getMonth() === date.month && new Date(record.updatedAtMs).getFullYear() === date.year)} />
        {/each}
      {:else if selected === 'action'}
        {#if data.history.find(r => r.previousValue?.length === 0)}<RecordsBlock {selected} records={data.history.filter(record => record.previousValue?.length === 0)} />{/if}
        {#if data.history.find(r => r.currentValue?.length != 0 && r.previousValue?.length != 0)}<RecordsBlock {selected} records={data.history.filter(record => record.currentValue?.length != 0 && record.previousValue?.length != 0)} />{/if}
        {#if data.history.find(r => r.currentValue?.length === 0)}<RecordsBlock {selected} records={data.history.filter(record => record.currentValue?.length === 0)} />{/if}
      {:else if selected === 'editor'}
        {#each editors as editor}
          <RecordsBlock {selected} records={data.history.filter(record => record.updatedBy === editor)} />
        {/each}
      {:else if selected === 'lexeme'}
        {#each entries as entry}
          <RecordsBlock {selected} records={data.history.filter(record => record.entryId === entry)} />
        {/each}
      {:else if selected === 'field'}
        {#each fields as field}
          <RecordsBlock {selected} records={data.history.filter(record => record.field === field)} />
        {/each}
      {/if}
    {:else}
      <p>History is empty</p>
    {/if}
  {:else}
    Only Managers and contributors can see this.
  {/if}
</div>


