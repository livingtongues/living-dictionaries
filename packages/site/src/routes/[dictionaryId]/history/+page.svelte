<script lang="ts">
  import { t } from 'svelte-i18n';
  import { canEdit } from '$lib/stores';
  import Block from './Block.svelte';
  // import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';

  export let data;
  interface monthAndYear {
    month: number;
    year: number;
  }
  let dates: monthAndYear[]
  $: if (data.history.length > 0) {
    const reducedDates = data.history.reduce((acc, record) => {
      const date = record.updatedAt.toDate();
      const month = date.getMonth();
      const year = date.getFullYear();
      const key = `${month}-${year}`;

      if (!acc.has(key))
        acc.set(key, {month, year});

      return acc;
    }, new Map());

    dates = Array.from(reducedDates.values());
  }
</script>

<div>
  <h3 class="text-xl font-semibold mb-3">
    {$t('dictionary.history', { default: 'History' })}
  </h3>

  {#if canEdit}
    {#if data.history.length > 0}
      {#each dates as date}
        <Block records={data.history.filter(record => record.updatedAt.toDate().getMonth() === date.month && record.updatedAt.toDate().getFullYear() === date.year)} />
      {/each}
    {:else}
      <p>History is empty</p>
    {/if}
  {:else}
    Only Managers and contributors can see this.
  {/if}
</div>


