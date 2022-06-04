<script lang="ts">
  import type { IDictionary } from '@living-dictionaries/types';
  import ResponsiveTable from 'svelte-pieces/ui/ResponsiveTable.svelte';
  import { Collection, updateOnline } from '$sveltefirets';
  import { arrayRemove, arrayUnion, deleteField, GeoPoint } from 'firebase/firestore/lite';
  import { exportDictionariesAsCSV } from '$lib/export/csv';
  import Filter from '@living-dictionaries/parts/src/lib/helpers/Filter.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import DictionaryRow from './_DictionaryRow.svelte';
  import SortDictionaries from './_SortDictionaries.svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';

  let dictionariesType: IDictionary[] = [];
</script>

<ShowHide let:show let:toggle>
  <div class="mb-2 text-xs text-gray-600">
    Changed data autosaves after 2 seconds. Green cells = data that's not saved. Use "tab" to
    quickly move between cells.
  </div>

  <Collection path={'dictionaries'} startWith={dictionariesType} let:data={dictionaries}>
    <div class="sticky top-0 h-[calc(100vh-1.5rem)] z-2 relative flex flex-col">
      <Filter
        items={dictionaries}
        let:filteredItems={filteredDictionaries}
        placeholder="Search dictionaries">
        <div slot="right">
          <Button form="filled" onclick={toggle}>Show {show ? 30 : 'All'}</Button>
          <Button
            form="filled"
            color="black"
            onclick={() =>
              exportDictionariesAsCSV(filteredDictionaries, 'living-dictionaries-list')}>
            <i class="fas fa-download mr-1" />
            Download {filteredDictionaries.length} Dictionaries as CSV
          </Button>
        </div>
        <div class="mb-1" />
        <ResponsiveTable stickyHeading stickyColumn>
          <SortDictionaries dictionaries={filteredDictionaries} let:sortedDictionaries>
            {#each sortedDictionaries as dictionary, index (dictionary.id)}
              {#if index < 30 || show}
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
                  on:updatecoordinates={({ detail: { lat, lng } }) => {
                    try {
                      const location = new GeoPoint(lat, lng);
                      updateOnline(`dictionaries/${dictionary.id}`, {
                        coordinates: location,
                      });
                    } catch (err) {
                      alert(err);
                    }
                  }}
                  on:removecoordinates={() => {
                    try {
                      updateOnline(`dictionaries/${dictionary.id}`, {
                        coordinates: deleteField(),
                      });
                    } catch (err) {
                      alert(err);
                    }
                  }} />
              {/if}
            {/each}
          </SortDictionaries>
        </ResponsiveTable>
      </Filter>
    </div>
  </Collection>
</ShowHide>
