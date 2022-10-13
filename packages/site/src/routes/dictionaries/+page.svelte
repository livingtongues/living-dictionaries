<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { Collection } from 'sveltefirets';
  import { orderBy, where } from 'firebase/firestore';
  import { admin } from '$lib/stores';
  import { exportDictionariesAsCSV } from '$lib/export/csv';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import ResponsiveTable from 'svelte-pieces/ui/ResponsiveTable.svelte';
  import Header from '$lib/components/shell/Header.svelte';
  
  import type { PageData } from './$types';
  export let data: PageData;
  $: publicDictionaries = data.publicDictionaries || [];

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

<div class="p-3 sticky top-0 relative z-2 h-screen flex flex-col bg-white">
  <Collection
    path="dictionaries"
    startWith={publicDictionaries}
    {queryConstraints}
    let:data={dictionaries}>
    <div>
      <Button
        form="filled"
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
    <ResponsiveTable stickyColumn stickyHeading class="my-1">
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
</div>

<style>
  thead th {
    --at-apply: text-xs font-semibold text-gray-600 uppercase tracking-wider;
  }
</style>