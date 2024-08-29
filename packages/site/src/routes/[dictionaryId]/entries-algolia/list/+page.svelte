<script lang="ts">
  // import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import { getContext, onDestroy, onMount } from 'svelte'
  import { Doc } from 'sveltefirets'
  import { configure } from 'instantsearch.js/es/widgets/index.js'
  import type { InstantSearch } from 'instantsearch.js'
  import ListEntry from './ListEntry.svelte'
  import List from './List.svelte'
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry'
  import Hits from '$lib/components/search/Hits.svelte'
  import Pagination from '$lib/components/search/Pagination.svelte'
  import { navigating, page } from '$app/stores'
  import { restore_scroll_point, save_scroll_point } from '$lib/helpers/scrollPoint'
  import { browser } from '$app/environment'

  export let data
  $: ({ dictionary, can_edit, admin, dbOperations } = data)

  const search: InstantSearch = getContext('search')
  let pixels_from_top = 0

  onMount(() => {
    search.addWidgets([
      configure({
        // @ts-ignore odd error in CI
        hitsPerPage: 30,
      }),
    ])
  })

  onDestroy(() => {
    if (!browser || !$navigating?.from?.url) return
    const { href } = $navigating.from.url
    save_scroll_point(href, pixels_from_top)
  })
</script>

<svelte:window bind:scrollY={pixels_from_top} />

<Hits {search} let:entries on_updated={restore_scroll_point}>
  {#if $can_edit}
    {#each entries as algoliaEntry (algoliaEntry.id)}
      <Doc
        path="dictionaries/{$dictionary.id}/words/{algoliaEntry.id}"
        startWith={algoliaEntry}
        let:data={entry}>
        <ListEntry
          dictionary={$dictionary}
          entry={convert_and_expand_entry(entry, $page.data.t)}
          videoAccess={$dictionary.videoAccess || $admin > 0}
          can_edit={$can_edit}
          {dbOperations} />
      </Doc>
    {/each}
  {:else}
    <List {entries} can_edit={false} dictionary={$dictionary} {dbOperations} />
  {/if}
</Hits>
<Pagination addNewEntry={dbOperations.addNewEntry} {search} />

<!-- <SeoMetaTags
  title={$page.data.t(''})}
  dictionaryName={$dictionary.name}
  description={$page.data.t(''})}
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" /> -->
