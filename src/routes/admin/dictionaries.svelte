<script lang="ts">
  import DictionaryFieldEdit from './_DictionaryFieldEdit.svelte';
  import type { IDictionary } from '$lib/interfaces';
  import ResponsiveTable from '$lib/components/ui/ResponsiveTable.svelte';
  import Collection from '$sveltefire/Collection.svelte';
  import { deleteField, GeoPoint, orderBy } from 'firebase/firestore';
  import { update } from '$sveltefire/firestore';

  let dictionariesType: IDictionary[] = [];
  let dictionaryToEditCoordinates: IDictionary;

  async function saveCoordinates(event) {
    try {
      const location = new GeoPoint(event.detail.lat, event.detail.lng);
      update(`dictionaries/${event.detail.dictionary.id}`, { coordinates: location });
    } catch (err) {
      alert(err);
    }
  }

  async function removeCoordinates(event) {
    try {
      update(`dictionaries/${event.detail.dictionaryId}`, {
        coordinates: deleteField(),
      });
    } catch (err) {
      alert(err);
    }
  }
</script>

<div class="mb-2 text-xs text-gray-600">
  Changed data autosaves after 2 seconds. Green cells = data that's not saved. Use "tab" to quickly
  move between cells.
</div>

<Collection
  path={'dictionaries'}
  queryConstraints={[orderBy('name')]}
  startWith={dictionariesType}
  let:data={dictionaries}
  traceId={'editDictionaries'}
  log>
  <ResponsiveTable>
    <thead>
      <th>Public</th>
      <th>Dictionary Name</th>
      <th>ISO 639-3</th>
      <th>Glottocode</th>
      <th>
        Coordinates
        <div class="text-xs text-gray-500">(Lat, Lng)</div>
      </th>
      <th>
        Location
        <div class="text-xs text-gray-500">plainly written</div>
      </th>
      <th>Entries</th>
    </thead>

    {#each dictionaries as dictionary}
      <tr>
        <td class="italic">
          {dictionary.public ? 'Yes' : ''}
        </td>
        <td class="italic">
          <DictionaryFieldEdit
            field={'name'}
            value={dictionary.name}
            dictionaryId={dictionary.id} />
        </td>
        <td>
          <DictionaryFieldEdit
            field={'iso6393'}
            value={dictionary.iso6393}
            dictionaryId={dictionary.id} />
        </td>
        <td>
          <DictionaryFieldEdit
            field={'glottocode'}
            value={dictionary.glottocode}
            dictionaryId={dictionary.id} />
        </td>
        <td>
          <button
            type="button"
            on:click={() => (dictionaryToEditCoordinates = dictionary)}
            class="py-1 hover:text-black text-left">
            {#if dictionary.coordinates}
              {dictionary.coordinates.latitude}°
              {dictionary.coordinates.latitude < 0 ? 'S' : 'N'},
              {dictionary.coordinates.longitude}°
              {dictionary.coordinates.longitude < 0 ? 'W' : 'E'}
            {:else}<b>Add</b>{/if}
          </button>
        </td>
        <td>
          <DictionaryFieldEdit
            field={'location'}
            value={dictionary.location}
            dictionaryId={dictionary.id} />
        </td>
        <td>
          {dictionary.entryCount}
        </td>
      </tr>
    {/each}
  </ResponsiveTable>
</Collection>

{#if dictionaryToEditCoordinates}
  {#await import('$lib/components/modals/Coordinates.svelte') then { default: Coordinates }}
    <Coordinates
      on:close={() => {
        dictionaryToEditCoordinates = null;
      }}
      dictionary={dictionaryToEditCoordinates}
      on:save={saveCoordinates}
      on:remove={removeCoordinates} />
  {/await}
{/if}

<!-- Contributors (add), glossLanguages, alternateNames, alternateOrthographies -->
