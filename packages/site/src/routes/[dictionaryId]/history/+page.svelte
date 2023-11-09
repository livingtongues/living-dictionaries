<script lang="ts">
  // import { page } from '$app/stores';
  import { canEdit } from '$lib/stores';
  import Block from './Block.svelte';
  // import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';

  export let data;
  interface monthAndYear {
    month: number;
    year: number;
  }
  let dates: monthAndYear[];
  let selected: 'date' | 'action' | 'editor' | 'lexeme' | 'field' = 'date';
  const options = [
    'date',
    'action',
    'editor',
    'lexeme',
    'field'
  ]

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

  $: if (data.history.length > 0)
    sortByDates();

</script>

<div>
  <h3 class="text-xl font-semibold mb-3">
    History <!-- {$page.data.t('dictionary.history')} -->
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
    {#if data.history.length > 0}
      {#each dates as date}
        <Block records={data.history.filter(record => new Date(record.updatedAtMs).getMonth() === date.month && new Date(record.updatedAtMs).getFullYear() === date.year)} />
      {/each}
    {:else}
      <p>History is empty</p>
    {/if}
  {:else}
    Only Managers and contributors can see this.
  {/if}
</div>


