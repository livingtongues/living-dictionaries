<script lang="ts">
  import type { DictionarySortKey } from './filter-sort-dictionaries'
  import IconDownload from '~icons/fa-solid/download'
  import IconPencilAlt from '~icons/fa-solid/pencil-alt'
  import IconKey from '~icons/fa-solid/key'
  import IconMdiArrowUp from '~icons/mdi/arrow-up'
  import IconMdiArrowDown from '~icons/mdi/arrow-down'
  import IconMdiMagnify from '~icons/mdi/magnify'
  import IconMdiClose from '~icons/mdi/close'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import ResponsiveTable from '$lib/components/ui/ResponsiveTable.svelte'
  import { page } from '$app/state'
  import Header from '$lib/components/shell/Header.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { download_objects_as_csv } from '$lib/export/csv'
  import { dictionary_headers, prepare_dictionary_for_csv } from '$lib/export/prepare-dictionaries-for-csv'
  import { filter_dictionaries, sort_dictionaries } from './filter-sort-dictionaries'

  const { auth_user, dictionaries, ssr_dictionaries } = $derived(page.data)
  // SSR rows paint (and are crawled) first; the client store replaces them once its
  // fetch lands — it carries the extra columns the admin view + CSV export need.
  const filtered_dictionaries = $derived.by(() => {
    if (!$dictionaries?.length)
      return ssr_dictionaries
    return auth_user.admin_level >= 1 ? $dictionaries : $dictionaries.filter(dictionary => dictionary.public)
  })

  let query = $state('')
  let sort_key = $state<DictionarySortKey>('name')
  let sort_ascending = $state(true)

  const COLUMNS: { key: DictionarySortKey, label: string }[] = $derived([
    { key: 'name', label: page.data.t('dictionary.name_of_language') },
    { key: 'entry_count', label: page.data.t('about.entry_count') },
    { key: 'url', label: 'URL' },
    { key: 'iso_639_3', label: 'ISO 639-3' },
    { key: 'glottocode', label: 'Glottocode' },
    { key: 'location', label: page.data.t('dictionary.location') },
    { key: 'latitude', label: page.data.t('dictionary.latitude') },
    { key: 'longitude', label: page.data.t('dictionary.longitude') },
  ])

  const visible_dictionaries = $derived(sort_dictionaries({
    dictionaries: filter_dictionaries({ dictionaries: filtered_dictionaries, query }),
    key: sort_key,
    ascending: sort_ascending,
  }))

  function toggle_sort(key: DictionarySortKey) {
    if (sort_key === key) {
      sort_ascending = !sort_ascending
      return
    }
    sort_key = key
    // Names, codes and places read best A→Z; entry counts most-first.
    sort_ascending = key !== 'entry_count'
  }
</script>

<Header>{page.data.t('home.list_of_dictionaries')}</Header>

<div class="dict-list-panel">
  <div class="toolbar">
    <div class="search-field">
      <IconMdiMagnify class="search-icon" />
      <input
        type="search"
        class="text-input"
        placeholder={page.data.t('home.search_dictionaries')}
        bind:value={query} />
      {#if query}
        <button type="button" class="clear-button" aria-label={page.data.t('misc.clear')} onclick={() => query = ''}>
          <IconMdiClose />
        </button>
      {/if}
    </div>

    <div class="toolbar-actions">
      {#if query.trim()}
        <!-- Only while filtering — the site footer already carries the plain total. -->
        <span class="result-count">{visible_dictionaries.length} / {filtered_dictionaries.length}</span>
      {/if}
      <HeadlessButton
        class="btn-primary btn-default"
        onclick={() =>
          download_objects_as_csv(
            dictionary_headers,
            visible_dictionaries.map(prepare_dictionary_for_csv),
            'living-dictionaries-list',
          )}>
        <IconDownload class="icon-gap-right" />
        {page.data.t('misc.download')}
        (.csv)
      </HeadlessButton>
      {#if auth_user.is_admin}
        <HeadlessButton class="btn btn-default" href="/admin/dictionaries">
          <IconPencilAlt class="icon-gap-right" />
          Edit
          <IconKey class="icon-gap-left" style="font-size: 0.875em" />
        </HeadlessButton>
      {/if}
    </div>
  </div>

  <ResponsiveTable stickyColumn stickyHeading class="dict-table">
    <thead>
      <tr>
        {#each COLUMNS as column (column.key)}
          <th aria-sort={sort_key === column.key ? (sort_ascending ? 'ascending' : 'descending') : 'none'}>
            <button type="button" class="sort-button" onclick={() => toggle_sort(column.key)}>
              {column.label}
              {#if sort_key === column.key}
                {#if sort_ascending}<IconMdiArrowUp />{:else}<IconMdiArrowDown />{/if}
              {/if}
            </button>
          </th>
        {/each}
      </tr>
    </thead>
    <!-- `<tbody>` is required: rows placed directly under `<table>` trip Svelte's
         `node_invalid_placement_ssr` and risk a hydration mismatch as the browser
         repairs the HTML. -->
    <tbody>
      {#each visible_dictionaries as { url, metadata, name, entry_count, iso_639_3, glottocode, location, coordinates } (url)}
        {@const first_latitude = coordinates?.points?.[0]?.coordinates.latitude}
        {@const first_longitude = coordinates?.points?.[0]?.coordinates.longitude}
        {@const external = !!metadata?.url}
        <tr>
          <td class="name-cell">
            <!-- The name is the thing people came to click. It used to be inert text
               while the URL column carried the only link on the row. -->
            <a href={metadata?.url || `/${url}`} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{name}</a>
          </td>
          <td>
            {metadata?.url?.startsWith('http://talkingdictionary') ? '' : entry_count}
          </td>
          <td class="url-cell">
            {#if metadata?.url}
              <a href={metadata.url} target="_blank" rel="noreferrer">{metadata.url}</a>
            {:else}
              <a href={`/${url}`}>https://livingdictionaries.app/{url}</a>
            {/if}
          </td>
          <td>
            {iso_639_3 || ''}
          </td>
          <td>
            {glottocode || ''}
          </td>
          <td>
            {location || ''}
          </td>
          <td class="nowrap-cell">
            {first_latitude ? `${first_latitude}° ${first_latitude < 0 ? 'S' : 'N'}` : ''}
          </td>
          <td class="nowrap-cell">
            {first_longitude ? `${first_longitude}° ${first_longitude < 0 ? 'W' : 'E'}` : ''}
          </td>
        </tr>
      {/each}
    </tbody>
  </ResponsiveTable>

  {#if query.trim() && !visible_dictionaries.length}
    <p class="no-results">{page.data.t('home.no_results')}</p>
  {/if}
</div>

<SeoMetaTags
  title={page.data.t('home.list_of_dictionaries')}
  description="A dynamically updated list of all the public dictionaries available on the Living Dictionaries platform. This list includes the names, URLs, GPS coordinates, ISO 639-3 Codes and Glottocodes associated with the Living Dictionaries. Living Dictionaries are language documentation tools that support endangered and under-represented languages"
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder" />

<style>
  .dict-list-panel {
    padding: 0.75rem;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background-color: var(--background);
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .search-field {
    position: relative;
    flex: 1 1 16rem;
    max-width: 26rem;
    display: flex;
    align-items: center;
  }
  .search-field :global(.search-icon) {
    position: absolute;
    left: 0.6rem;
    color: var(--color-secondary);
    pointer-events: none;
  }
  .search-field input {
    width: 100%;
    padding-left: 2rem;
    padding-right: 2rem;
  }
  /* The UA's own search-clear widget would sit right next to ours. */
  .search-field input::-webkit-search-cancel-button {
    display: none;
  }
  .clear-button {
    position: absolute;
    right: 0.4rem;
    display: flex;
    padding: 0.25rem;
    border-radius: 9999px;
    color: var(--color-secondary);
  }
  .clear-button:hover {
    color: var(--color);
    background-color: var(--surface);
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .result-count {
    font-size: 0.8125rem;
    color: var(--color-secondary);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .dict-list-panel :global(.icon-gap-right) {
    margin-right: 0.25rem;
  }

  .dict-list-panel :global(.icon-gap-left) {
    margin-left: 0.25rem;
  }

  .dict-list-panel :global(.dict-table) {
    margin-top: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .name-cell {
    font-weight: 600;
  }
  /* The primary click target of the row must LOOK clickable — this column was
     inert text until 2026-08-03. */
  .name-cell a {
    color: var(--primary);
  }
  .name-cell a:hover {
    text-decoration-line: underline;
  }

  .url-cell {
    text-decoration-line: underline;
  }

  .nowrap-cell {
    white-space: nowrap;
  }

  .no-results {
    padding: 1.5rem 0.25rem;
    color: var(--color-secondary);
  }

  .sort-button {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    font: inherit;
    color: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    white-space: nowrap;
  }
  .sort-button:hover {
    color: var(--color);
  }

  thead th {
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 600;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
