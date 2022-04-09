<script lang="ts">
  import type { IDictionary } from '@ld/types';
  import ResponsiveTable from '$lib/components/ui/ResponsiveTable.svelte';
  import { Collection, updateOnline } from '$sveltefirets';
  import { arrayRemove, arrayUnion, deleteField, GeoPoint } from 'firebase/firestore/lite';
  import { exportDictionariesAsCSV } from '$lib/export/csv';
  import Filter from './_Filter.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
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
        form="filled"
        color="black"
        onclick={() => exportDictionariesAsCSV(filteredDictionaries, 'living-dictionaries-list')}>
        <i class="fas fa-download mr-1" />
        Download {filteredDictionaries.length} Dictionaries as CSV
      </Button>
    </div>
    <ResponsiveTable class="my-1">
      <SortDictionaries dictionaries={filteredDictionaries} let:sortedDictionaries>
        {#each sortedDictionaries as dictionary (dictionary.id)}
          <DictionaryRow
            {dictionary}
            on:toggleprivacy={() => {
              try {
                updateOnline(`dictionaries/${dictionary.id}`, {
                  public: !dictionary.public,
                });
              } catch (err) {
                alert(err);
              }
            }}
            on:togglevideoaccess={() => {
              try {
                updateOnline(`dictionaries/${dictionary.id}`, {
                  videoAccess: !dictionary.videoAccess,
                });
              } catch (err) {
                alert(err);
              }
            }}
            on:addalternatename={(event) => {
              try {
                updateOnline(`dictionaries/${dictionary.id}`, {
                  alternateNames: arrayUnion(event.detail),
                });
              } catch (err) {
                alert(err);
              }
            }}
            on:removealternatename={(event) => {
              try {
                updateOnline(`dictionaries/${dictionary.id}`, {
                  alternateNames: arrayRemove(event.detail),
                });
              } catch (err) {
                alert(err);
              }
            }}
            on:save={(event) => {
              try {
                const location = new GeoPoint(event.detail.lat, event.detail.lng);
                updateOnline(`dictionaries/${event.detail.dictionary.id}`, {
                  coordinates: location,
                });
              } catch (err) {
                alert(err);
              }
            }}
            on:remove={(event) => {
              try {
                updateOnline(`dictionaries/${event.detail.dictionary.id}`, {
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
