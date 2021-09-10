<script context="module" lang="ts">
  import { fetchDictionaries } from '$lib/helpers/fetchDictionaries';
  import { browser } from '$app/env';

  import type { Load } from '@sveltejs/kit';
  export const load: Load = async () => {
    try {
      const fetchedDictionaries = browser ? [] : await fetchDictionaries();
      return { props: { fetchedDictionaries } };
    } catch (error) {
      return {
        error, // status: res.status,
      };
    }
  };
</script>

<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IDictionary } from '$lib/interfaces';
  export let fetchedDictionaries: IDictionary[] = [];
  import { admin } from '$lib/stores';
  import View from '$lib/components/ui/View.svelte';
  import { exportDictionariesAsCSV } from '$lib/export/csv';
  import Button from '$svelteui/ui/Button.svelte';
  import ResponsiveTable from '$lib/components/ui/ResponsiveTable.svelte';
  import Header from '$lib/components/shell/Header.svelte';
  import { orderBy, where } from 'firebase/firestore';
  import Collection from '$sveltefire/components/Collection.svelte';

  let queryConstraints = [orderBy('name'), where('public', '==', true)];
  $: if ($admin) {
    queryConstraints = [orderBy('name')];
  }
</script>

<svelte:head>
  <title>
    {$_('home.list_of_dictionaries', { default: 'List of Dictionaries' })}
  </title>
</svelte:head>

<Header>{$_('home.list_of_dictionaries', { default: 'List of Dictionaries' })}</Header>

<View padding={true}>
  <Collection
    path="dictionaries"
    startWith={fetchedDictionaries}
    {queryConstraints}
    let:data={dictionaries}>
    <div>
      <Button
        form="primary"
        color="black"
        onclick={() => exportDictionariesAsCSV(dictionaries, 'living-dictionaries-list')}>
        <i class="fas fa-download mr-1" />
        {$_('misc.download', { default: 'Download' })}
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
    <ResponsiveTable class="my-1">
      <thead>
        <th>
          {$_('dictionary.name_of_language', { default: 'Name of Language' })}
        </th>
        <th> URL </th>
        <th> ISO 639-3 </th>
        <th> Glottocode </th>
        <th>
          {$_('dictionary.location', { default: 'Location' })}
        </th>
        <th>
          {$_('dictionary.latitude', { default: 'Latitude' })}
        </th>
        <th>
          {$_('dictionary.longitude', { default: 'Longitude' })}
        </th>
      </thead>
      {#each dictionaries as dictionary}
        <tr>
          <td class="font-semibold">
            <a href={dictionary.url}>{dictionary.name}</a>
          </td>
          <td class="underline">
            {#if dictionary.url}
              <a href={dictionary.url} target="_blank">{dictionary.url}</a>
            {:else}
              <a href={`/${dictionary.id}`}>https://livingdictionaries.app/{dictionary.id}</a>
            {/if}
          </td>
          <td>
            {dictionary.iso6393 ? dictionary.iso6393 : ''}
          </td>
          <td>
            {dictionary.glottocode ? dictionary.glottocode : ''}
          </td>
          <td>
            {dictionary.location ? dictionary.location : ''}
          </td>
          <td class="whitespace-nowrap">
            {dictionary.coordinates
              ? dictionary.coordinates.latitude +
                '° ' +
                (dictionary.coordinates.latitude < 0 ? 'S' : 'N')
              : ''}
          </td>
          <td class="whitespace-nowrap">
            {dictionary.coordinates
              ? dictionary.coordinates.longitude +
                '° ' +
                (dictionary.coordinates.longitude < 0 ? 'W' : 'E')
              : ''}
          </td>
        </tr>
      {/each}
    </ResponsiveTable>
  </Collection>
</View>
