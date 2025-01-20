<script lang="ts">
  import { Button, ResponsiveTable } from 'svelte-pieces'
  import { page } from '$app/stores'
  import Header from '$lib/components/shell/Header.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { downloadObjectsAsCSV } from '$lib/export/csv'
  import { dictionary_headers, prepareDictionaryForCsv } from '$lib/export/prepareDictionariesForCsv'

  export let data
  $: ({ admin, dictionaries } = data)
</script>

<Header>{$page.data.t('home.list_of_dictionaries')}</Header>

<div class="p-3 sticky top-0 relative z-2 h-screen flex flex-col bg-white">
  <div>
    <Button
      form="filled"
      color="black"
      onclick={() =>
        downloadObjectsAsCSV(
          dictionary_headers,
          dictionaries.map(prepareDictionaryForCsv),
          'living-dictionaries-list',
        )}>
      <i class="fas fa-download mr-1" />
      {$page.data.t('misc.download')}
      (.csv)
    </Button>
    {#if $admin}
      <Button href="/admin/dictionaries" color="black">
        <i class="far fa-pencil mr-1" />
        Edit
        <i class="far fa-key fa-sm ml-1" />
      </Button>
    {/if}
  </div>
  <ResponsiveTable stickyColumn stickyHeading class="my-1">
    <thead>
      <th>
        {$page.data.t('dictionary.name_of_language')}
      </th>
      <th> {$page.data.t('about.entry_count')} </th>
      <th> URL </th>
      <th> ISO 639-3 </th>
      <th> Glottocode </th>
      <th>
        {$page.data.t('dictionary.location')}
      </th>
      <th>
        {$page.data.t('dictionary.latitude')}
      </th>
      <th>
        {$page.data.t('dictionary.longitude')}
      </th>
    </thead>
    {#each dictionaries as { id, metadata, name, entry_count, iso_639_3, glottocode, location, coordinates }}
      {@const first_latitude = coordinates?.points?.[0]?.coordinates.latitude}
      {@const first_longitude = coordinates?.points?.[0]?.coordinates.longitude}
      <tr>
        <td class="font-semibold">
          {name}
        </td>
        <td>
          {metadata?.url?.startsWith('http://talkingdictionary') ? '' : entry_count}
        </td>
        <td class="underline">
          {#if metadata?.url}
            <a href={metadata.url} target="_blank" rel="noreferrer">{metadata.url}</a>
          {:else}
            <a href={`/${id}`}>https://livingdictionaries.app/{id}</a>
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
        <td class="whitespace-nowrap">
          {first_latitude ? `${first_latitude}° ${first_latitude < 0 ? 'S' : 'N'}` : ''}
        </td>
        <td class="whitespace-nowrap">
          {first_longitude ? `${first_longitude}° ${first_longitude < 0 ? 'W' : 'E'}` : ''}
        </td>
      </tr>
    {/each}
  </ResponsiveTable>
</div>

<SeoMetaTags
  title={$page.data.t('home.list_of_dictionaries')}
  description="A dynamically updated list of all the public dictionaries available on the Living Dictionaries platform. This list includes the names, URLs, GPS coordinates, ISO 639-3 Codes and Glottocodes associated with the Living Dictionaries. Living Dictionaries are language documentation tools that support endangered and under-represented languages"
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder" />

<style>
  thead th {
    --at-apply: text-xs font-semibold text-gray-600 uppercase tracking-wider;
  }
</style>
