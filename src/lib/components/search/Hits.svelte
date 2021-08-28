<script lang="ts">
  import type { InstantSearch } from 'instantsearch.js';
  export let search: InstantSearch;

  import type { IEntry } from '$lib/interfaces';
  let hits: IEntry[] = [];
  let recentlyUpdatedEntries: IEntry[] = [];

  let entries: IEntry[] = [];
  $: entries = mergeBy<IEntry>(hits, recentlyUpdatedEntries, 'id');
  function mergeBy<T>(sourceArray: T[], updatingArray: T[], field: string) {
    let mergedArr = sourceArray;
    for (const value of updatingArray.reverse()) {
      const matchedIndex = sourceArray.findIndex((x) => x[field] === value[field]);
      if (matchedIndex >= 0) {
        sourceArray[matchedIndex] = value;
      } else {
        mergedArr.unshift(value);
      }
    }
    return mergedArr;
  }

  import { onMount } from 'svelte';
  // import { connectHits } from 'instantsearch.js/es/connectors';
  import { connectHits } from 'instantsearch.js/cjs/connectors/index.js';
  import { page } from '$app/stores';
  import { user } from '$sveltefire/user';
  import { limit, orderBy, where, Timestamp } from 'firebase/firestore';
  import type { Timestamp as TimestampType } from 'firebase/firestore';
  let withinLastHour: TimestampType;

  onMount(() => {
    const customHits = connectHits((params) => {
      // @ts-ignore
      hits = params.hits.map((hit) => {
        return { ...hit, id: hit.objectID };
      });
    });

    search.addWidgets([customHits({})]);

    const HOUR = 1000 * 60 * 60;
    const hourAgo = Date.now() - HOUR;
    withinLastHour = Timestamp.fromMillis(hourAgo);
  });
</script>

{#if $user && withinLastHour}
  {#await import('$sveltefire/Collection.svelte') then { default: Collection }}
    <Collection
      path={`dictionaries/${$page.params.dictionaryId}/words`}
      queryConstraints={[
        where('ub', '==', $user.uid),
        where('ua', '>', withinLastHour),
        orderBy('ua', 'desc'),
        limit(5),
      ]}
      startWith={recentlyUpdatedEntries}
      on:data={(e) =>
        (recentlyUpdatedEntries = e.detail.data.map((entry) => ({
          ...entry,
          updatedRecently: true,
        })))} />
  {/await}
{/if}

<slot {entries}>Loading...</slot>
