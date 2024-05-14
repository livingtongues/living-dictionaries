<script lang="ts" context="module">
  import { type Writable, writable } from 'svelte/store'

  const options: Writable<SelectOption[]> = writable([])
  let fetchedDictionaryId: string
</script>

<script lang="ts">
  import { onMount } from 'svelte'
  import ModalEditableArray from '../ui/array/ModalEditableArray.svelte'
  import type { SelectOption } from '../ui/array/select-options.interface'
  import { page } from '$app/stores'
  import { browser } from '$app/environment'
  import { PUBLIC_ALGOLIA_APPLICATION_ID, PUBLIC_ALGOLIA_SEARCH_ONLY_API_KEY } from '$env/static/public'
  import { post_request } from '$lib/helpers/get-post-requests'

  export let dialects: string[] = []
  export let can_edit = false
  export let dictionaryId: string
  export let showPlus = true

  export let on_update: (new_value: string[]) => void

  onMount(async () => {
    if (browser && fetchedDictionaryId !== dictionaryId) {
      try {
        const dialects = await fetchDialects()
        if (dialects?.facetHits) {
          $options = dialects.facetHits.map(({ value }) => ({ name: value, value }))
        }
      } catch (error) {
        console.error(error)
      }
    }
  })

  interface IAlgoliaFacetsQuery {
    facetHits: {
      value: string
    }[]
    exhaustiveFacetsCount: boolean
    processingTimeMS: number
  }

  async function fetchDialects(): Promise<IAlgoliaFacetsQuery> {
    fetchedDictionaryId = dictionaryId

    const headers = {
      'X-Algolia-Application-Id': PUBLIC_ALGOLIA_APPLICATION_ID,
      'X-Algolia-API-Key': PUBLIC_ALGOLIA_SEARCH_ONLY_API_KEY,
    }

    const { error, data } = await post_request<any, IAlgoliaFacetsQuery>(`https://${PUBLIC_ALGOLIA_APPLICATION_ID}.algolia.net/1/indexes/entries_prod/facets/di/query`, { data: {
      facetFilters: [[`dictId:${dictionaryId}`]],
      maxFacetHits: 100, // Algolia max possible https://www.algolia.com/doc/api-reference/api-parameters/maxFacetHits/
    }, headers })

    if (error)
      console.error(error.message)

    if (data)
      return data
  }
</script>

<ModalEditableArray
  values={dialects}
  options={$options}
  {can_edit}
  canWriteIn
  {showPlus}
  placeholder={$page.data.t('entry_field.dialects')}
  {on_update}>
  <span slot="heading">{$page.data.t('entry_field.dialects')}</span>
</ModalEditableArray>
