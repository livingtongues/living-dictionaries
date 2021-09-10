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
  import SortDictionaries from './_SortDictionaries.svelte';

  let dictionariesType: IDictionary[] = [];
</script>

<div class="mb-2 text-xs text-gray-600">
  Changed data autosaves after 2 seconds. Green cells = data that's not saved. Use "tab" to quickly
  move between cells.
</div>

<Collection path={'dictionaries'} startWith={dictionariesType} let:data={dictionaries}>
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
      <SortDictionaries dictionaries={filteredDictionaries} let:sortedDictionaries>
        {#each sortedDictionaries as dictionary}
          <DictionaryRow
            {dictionary}
            on:toggleprivacy={() => {
              try {
                console.log({
                  public: !dictionary.public,
                });
                update(`dictionaries/${dictionary.id}`, {
                  public: !dictionary.public,
                });
              } catch (err) {
                alert(err);
              }
            }}
            on:addalternatename={(event) => {
              try {
                update(`dictionaries/${dictionary.id}`, {
                  alternateNames: arrayUnion(event.detail),
                });
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
      </SortDictionaries>
    </ResponsiveTable>
  </Filter>
</Collection>

<!-- TODO: Add Contributors -->
