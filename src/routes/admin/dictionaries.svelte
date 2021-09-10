<script lang="ts">
  import type { IDictionary } from '$lib/interfaces';
  import ResponsiveTable from '$lib/components/ui/ResponsiveTable.svelte';
  import Collection from '$sveltefire/components/Collection.svelte';
  import { arrayRemove, arrayUnion, deleteField, GeoPoint } from 'firebase/firestore';
  import { update } from '$sveltefire/firestore';
  import { exportDictionariesAsCSV } from '$lib/export/csv';
  import Filter from './_Filter.svelte';
  import Button from '$svelteui/ui/Button.svelte';
  import DictionaryRow from './_DictionaryRow.svelte';

  let dictionariesType: IDictionary[] = [];
</script>

<div class="mb-2 text-xs text-gray-600">
  Changed data autosaves after 2 seconds. Green cells = data that's not saved. Use "tab" to quickly
  move between cells.
</div>

<Collection
  path={'dictionaries'}
  startWith={dictionariesType}
  let:data={dictionaries}
  traceId={'editDictionaries'}>
  <Filter
    items={dictionaries}
    let:filteredItems={filteredDictionaries}
    placeholder="Search dictionaries">
    <div slot="right">
      <Button
        form="primary"
        color="black"
        onclick={() => exportDictionariesAsCSV(filteredDictionaries, 'living-dictionaries-list')}>
        <i class="fas fa-download mr-1" />
        Download {filteredDictionaries.length} Dictionaries as CSV
      </Button>
    </div>
    <ResponsiveTable class="my-1">
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
        <th>Gloss Languages</th>
        <th>Alternate Names</th>
        <th>Alternate Orthographies</th>
        <th>Created</th>
      </thead>
      <!-- <SortDictionaries dictionaries={filteredDictionaries} let:sortedDictionaries> -->
      {#each filteredDictionaries as dictionary}
        <DictionaryRow
          {dictionary}
          on:addalternatename={(event) => {
            try {
              update(`dictionaries/${dictionary.id}`, { alternateNames: arrayUnion(event.detail) });
            } catch (err) {
              alert(err);
            }
          }}
          on:removealternatename={(event) => {
            try {
              update(`dictionaries/${dictionary.id}`, {
                alternateNames: arrayRemove(event.detail),
              });
            } catch (err) {
              alert(err);
            }
          }}
          on:save={(event) => {
            try {
              const location = new GeoPoint(event.detail.lat, event.detail.lng);
              update(`dictionaries/${event.detail.dictionary.id}`, { coordinates: location });
            } catch (err) {
              alert(err);
            }
          }}
          on:remove={(event) => {
            try {
              update(`dictionaries/${event.detail.dictionary.id}`, {
                coordinates: deleteField(),
              });
            } catch (err) {
              alert(err);
            }
          }} />
      {/each}
      <!-- </SortDictionaries> -->
    </ResponsiveTable>
  </Filter>
</Collection>

<!-- TODO: Add Contributors -->
