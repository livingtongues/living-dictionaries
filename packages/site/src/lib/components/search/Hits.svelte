<script lang="ts">
  import { onMount } from 'svelte';
  import { connectHits } from 'instantsearch.js/es/connectors';
  import { limit, orderBy } from 'firebase/firestore';
  import { dictionary_deprecated as dictionary } from '$lib/stores';
  import { mergeBy } from '$lib/helpers/array';
  import type { InstantSearch } from 'instantsearch.js';
  import { firebaseConfig } from 'sveltefirets';
  import type { ActualDatabaseEntry, LDAlgoliaHit } from '@living-dictionaries/types';
  import { Button, ShowHide } from 'svelte-pieces';

  export let search: InstantSearch;

  let hits: LDAlgoliaHit[] = [];
  let recentlyUpdatedEntries: ActualDatabaseEntry[] = [];
  $: entries = mergeBy<LDAlgoliaHit | ActualDatabaseEntry>(hits, recentlyUpdatedEntries, 'id');

  onMount(() => {
    const customHits = connectHits((params) => {
      hits = params.hits.map((hit) => {
        return { ...hit, id: hit.objectID };
      }) as unknown as LDAlgoliaHit[];
    });

    search.addWidgets([customHits({})]);
  });
</script>

<slot {entries}>Loading...</slot>

{#if firebaseConfig.projectId === 'talking-dictionaries-dev'}
  <ShowHide let:show let:toggle>
    {#if !show}
      <Button
        size="sm"
        form="simple"
        onclick={toggle}
        title="Because Algolia is not paying attention to dev">
        Dev only: Show 10 most recent edited entries
      </Button>
    {:else}
      <Button
        size="sm"
        form="simple"
        onclick={() => {
          toggle();
          recentlyUpdatedEntries = [];
        }}>
        Don't show 10 most recent edited entries
      </Button>
      {#await import('sveltefirets') then { Collection }}
        <Collection
          path={`dictionaries/${$dictionary.id}/words`}
          queryConstraints={[
            orderBy('ua', 'desc'),
            limit(10),
          ]}
          startWith={recentlyUpdatedEntries}
          on:data={(e) => (recentlyUpdatedEntries = e.detail.data)} />
      {/await}
    {/if}
  </ShowHide>
{/if}
