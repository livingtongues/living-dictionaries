<script lang="ts">
  import type { IDictionary, IHelper, IInvite } from '@living-dictionaries/types';
  import { updateOnline, collectionStore, getCollection } from 'sveltefirets';
  import { arrayRemove, arrayUnion, deleteField, GeoPoint } from 'firebase/firestore/lite';
  import Filter from '$lib/components/Filter.svelte';
  import { Button, ResponsiveTable, IntersectionObserverShared } from 'svelte-pieces';
  import DictionaryRow from './DictionaryRow.svelte';
  import SortDictionaries from './SortDictionaries.svelte';
  import { where } from 'firebase/firestore';
  import type { DictionaryWithHelperStores } from './dictionaryWithHelpers';
  import { exportAdminDictionariesAsCSV } from './export';

  const dictionaries = collectionStore<IDictionary>('dictionaries', [], {
    startWith: [],
    log: true,
  });

  const noopConstraints = [];
  const inviteQueryConstraints = [where('status', 'in', ['queued', 'sent'])];

  let dictionariesAndHelpers: DictionaryWithHelperStores[] = [];
  $: dictionariesAndHelpers = $dictionaries.map((dictionary) => {
    return {
      ...dictionary,
      managers: collectionStore<IHelper>(
        `dictionaries/${dictionary.id}/managers`,
        noopConstraints,
        { log: true }
      ),
      contributors: collectionStore<IHelper>(
        `dictionaries/${dictionary.id}/contributors`,
        noopConstraints,
        { log: true }
      ),
      writeInCollaborators: collectionStore<IHelper>(
        `dictionaries/${dictionary.id}/writeInCollaborators`,
        noopConstraints,
        { log: true }
      ),
      invites: collectionStore<IInvite>(
        `dictionaries/${dictionary.id}/invites`,
        inviteQueryConstraints,
        { log: true }
      ),
      getManagers: getCollection<IHelper>(`dictionaries/${dictionary.id}/managers`),
      getContributors: getCollection<IHelper>(`dictionaries/${dictionary.id}/managers`),
      getWriteInCollaborators: getCollection<IHelper>(
        `dictionaries/${dictionary.id}/writeInCollaborators`
      ),
      getInvites: getCollection<IInvite>(
        `dictionaries/${dictionary.id}/invites`,
        inviteQueryConstraints
      ),
    };
  });
</script>

<div class="mb-2 text-xs text-gray-600">
  Changed data autosaves after 2 seconds. Green cells = data that's not saved. Use "tab" to quickly
  move between cells.
</div>

<div class="sticky top-0 h-[calc(100vh-1.5rem)] z-2 relative flex flex-col">
  <Filter
    items={dictionariesAndHelpers}
    let:filteredItems={filteredDictionaries}
    placeholder="Search dictionaries">
    <div slot="right">
      <Button
        form="filled"
        color="black"
        onclick={async () => await exportAdminDictionariesAsCSV(filteredDictionaries)}>
        <i class="fas fa-download mr-1" />
        Download {filteredDictionaries.length} Dictionaries as CSV
      </Button>
    </div>
    <div class="mb-1" />
    <ResponsiveTable stickyHeading stickyColumn>
      <SortDictionaries dictionaries={filteredDictionaries} let:sortedDictionaries>
        {#each sortedDictionaries as dictionary, index (dictionary.id)}
          <IntersectionObserverShared bottom={2000} let:intersecting once>
            {#if intersecting}
              <DictionaryRow
                {index}
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
            {:else}
              <tr>
                <td colspan="30"> Loading... </td>
              </tr>
            {/if}
          </IntersectionObserverShared>
        {/each}
      </SortDictionaries>
    </ResponsiveTable>
  </Filter>
</div>
