<script lang="ts" context="module">
  const options: Writable<SelectOption[]> = writable([]);
  let fetchedDictionaryId: string;
</script>

<script lang="ts">
  import { page } from '$app/stores';
  import { createEventDispatcher, onMount } from 'svelte';
  import { EntryFields } from '@living-dictionaries/types';
  import ModalEditableArray from '../ui/array/ModalEditableArray.svelte';
  import type { SelectOption } from '../ui/array/select-options.interface';
  import { browser } from '$app/environment';
  import { writable, type Writable } from 'svelte/store';
  import { PUBLIC_ALGOLIA_SEARCH_ONLY_API_KEY, PUBLIC_ALGOLIA_APPLICATION_ID } from '$env/static/public';
  import { post_request } from '$lib/helpers/get-post-requests';

  export let dialects: string[] = [];
  export let canEdit = false;
  export let dictionaryId: string;
  export let showPlus = true;

  const dispatch = createEventDispatcher<{
    valueupdate: {
      field: EntryFields.dialects;
      newValue: string[];
    };
  }>();

  onMount(async () => {
    if (browser && fetchedDictionaryId !== dictionaryId) {
      try {
        const dialects = await fetchDialects()
        $options = dialects.facetHits.map(({value}) => ({ name: value, value }));
      } catch (error) {
        console.error(error);
      }
    }
  });

  interface IAlgoliaFacetsQuery {
    facetHits: {
      value: string;
    }[];
    exhaustiveFacetsCount: boolean;
    processingTimeMS: number;
  }

  async function fetchDialects(): Promise<IAlgoliaFacetsQuery> {
    fetchedDictionaryId = dictionaryId;

    const headers = {
      'X-Algolia-Application-Id': PUBLIC_ALGOLIA_APPLICATION_ID,
      'X-Algolia-API-Key': PUBLIC_ALGOLIA_SEARCH_ONLY_API_KEY,
    };

    const { data } = await post_request<any, IAlgoliaFacetsQuery>(`https://${PUBLIC_ALGOLIA_APPLICATION_ID}.algolia.net/1/indexes/entries_prod/facets/di/query`, { data: {
      facetFilters: [[`dictId:${dictionaryId}`]],
      maxFacetHits: 100, // Algolia max possible https://www.algolia.com/doc/api-reference/api-parameters/maxFacetHits/
    }, headers});

    if (data)
      return data;
  }
</script>

<ModalEditableArray
  values={dialects}
  options={$options}
  {canEdit}
  canWriteIn
  {showPlus}
  placeholder={$page.data.t('entry_field.dialects')}
  on:update={({ detail: newValue }) => {
    dispatch('valueupdate', {
      field: EntryFields.dialects,
      newValue,
    });
  }}>
  <span slot="heading">{$page.data.t('entry_field.dialects')}</span>
</ModalEditableArray>
