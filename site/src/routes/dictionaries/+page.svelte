<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte'
  import ResponsiveTable from '$lib/components/ui/ResponsiveTable.svelte'
  import { page } from '$app/state'
  import Header from '$lib/components/shell/Header.svelte'
  import Footer from '$lib/components/shell/Footer.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { downloadObjectsAsCSV } from '$lib/export/csv'
  import { dictionary_headers, prepareDictionaryForCsv } from '$lib/export/prepareDictionariesForCsv'

  const { auth_user, dictionaries } = $derived(page.data)
  const filtered_dictionaries = $derived(auth_user.admin_level >= 1 ? $dictionaries : $dictionaries?.filter(dictionary => dictionary.public))

</script>

<Header>{page.data.t('home.list_of_dictionaries')}</Header>

<div class="dict-list-panel">
  <div>
    <Button
      form="filled"
      color="black"
      onclick={() =>
        downloadObjectsAsCSV(
          dictionary_headers,
          filtered_dictionaries.map(prepareDictionaryForCsv),
          'living-dictionaries-list',
        )}>
      <i class="fas fa-download icon-gap-right"></i>
      {page.data.t('misc.download')}
      (.csv)
    </Button>
    {#if auth_user.is_admin}
      <Button href="/admin/dictionaries" color="black">
        <i class="far fa-pencil icon-gap-right"></i>
        Edit
        <i class="far fa-key fa-sm icon-gap-left"></i>
      </Button>
    {/if}
  </div>
  <ResponsiveTable stickyColumn stickyHeading class="dict-table">
    <thead>
      <tr>
        <th>
          {page.data.t('dictionary.name_of_language')}
        </th>
        <th> {page.data.t('about.entry_count')} </th>
        <th> URL </th>
        <th> ISO 639-3 </th>
        <th> Glottocode </th>
        <th>
          {page.data.t('dictionary.location')}
        </th>
        <th>
          {page.data.t('dictionary.latitude')}
        </th>
        <th>
          {page.data.t('dictionary.longitude')}
        </th>
      </tr>
    </thead>
    {#each filtered_dictionaries as { url, metadata, name, entry_count, iso_639_3, glottocode, location, coordinates } (url)}
      {@const first_latitude = coordinates?.points?.[0]?.coordinates.latitude}
      {@const first_longitude = coordinates?.points?.[0]?.coordinates.longitude}
      <tr>
        <td class="name-cell">
          {name}
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
  </ResponsiveTable>
</div>

<Footer />

<SeoMetaTags
  title={page.data.t('home.list_of_dictionaries')}
  description="A dynamically updated list of all the public dictionaries available on the Living Dictionaries platform. This list includes the names, URLs, GPS coordinates, ISO 639-3 Codes and Glottocodes associated with the Living Dictionaries. Living Dictionaries are language documentation tools that support endangered and under-represented languages"
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder" />

<style>
  .dict-list-panel {
    padding: 0.75rem;
    position: sticky;
    top: 0;
    z-index: 2;
    height: 92vh;
    display: flex;
    flex-direction: column;
    background-color: var(--background);
  }

  .dict-list-panel :global(.icon-gap-right) {
    margin-right: 0.25rem;
  }

  .dict-list-panel :global(.icon-gap-left) {
    margin-left: 0.25rem;
  }

  .dict-list-panel :global(.dict-table) {
    margin-top: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .name-cell {
    font-weight: 600;
  }

  .url-cell {
    text-decoration-line: underline;
  }

  .nowrap-cell {
    white-space: nowrap;
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
