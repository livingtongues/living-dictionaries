<script lang="ts">
  import { onMount } from 'svelte';
  // import { connectHits } from 'instantsearch.js/es/connectors';
  import { connectHits } from 'instantsearch.js/cjs/connectors/index.js';
  import { limit, orderBy, where, Timestamp } from 'firebase/firestore';
  import { user } from '$sveltefire/user';
  import { canEdit, dictionary } from '$lib/stores';
  import { mergeBy } from '$lib/helpers/array';
  import type { IEntry } from '$lib/interfaces';
  import type { InstantSearch } from 'instantsearch.js';

  export let search: InstantSearch;

  let hits: IEntry[] = [];
  let recentlyUpdatedEntries: IEntry[] = [];
  $: entries = mergeBy<IEntry>(hits, recentlyUpdatedEntries, 'id');

  onMount(() => {
    const customHits = connectHits((params) => {
      // @ts-ignore
      hits = params.hits.map((hit) => {
        return { ...hit, id: hit.objectID };
      });
    });

    search.addWidgets([customHits({})]);
  });

  function minutesAgoTimestamp(minutes: number) {
    return Timestamp.fromMillis(Date.now() - minutes * 1000 * 60);
  }
</script>

<slot {entries}>Loading...</slot>

{#if $canEdit}
  {#await import('$sveltefire/components/Collection.svelte') then { default: Collection }}
    <Collection
      path={`dictionaries/${$dictionary.id}/words`}
      queryConstraints={[
        where('ub', '==', $user.uid),
        where('ua', '>', minutesAgoTimestamp(10)),
        orderBy('ua', 'desc'),
        limit(4),
      ]}
      startWith={recentlyUpdatedEntries}
      on:data={(e) => (recentlyUpdatedEntries = e.detail.data)} />
  {/await}
{/if}
