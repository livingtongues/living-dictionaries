<script lang="ts">
  import type { IHelper, IInvite, TablesUpdate } from '@living-dictionaries/types'
  import { collectionStore, getCollection } from 'sveltefirets'
  import { Button, IntersectionObserverShared, ResponsiveTable } from 'svelte-pieces'
  import { where } from 'firebase/firestore'
  import { onMount } from 'svelte'
  import DictionaryRow from './DictionaryRow.svelte'
  import SortDictionaries from './SortDictionaries.svelte'
  import type { DictionaryWithHelperStores } from './dictionaryWithHelpers'
  import { exportAdminDictionariesAsCSV } from './export'
  import type { PageData } from './$types'
  import Filter from '$lib/components/Filter.svelte'
  import { api_update_dictionary } from '$api/db/update-dictionary/_call'

  export let data: PageData

  const noopConstraints = []
  const inviteQueryConstraints = [where('status', 'in', ['queued', 'sent'])]

  let dictionariesAndHelpers: DictionaryWithHelperStores[] = []

  onMount(async () => {
    dictionariesAndHelpers = await get_dictionaries_with_helpers()
  })

  async function get_dictionaries_with_helpers() {
    const { data: dictionaries, error } = await data.supabase.from('dictionaries_view')
      .select()
    if (error) {
      console.error(error)
      alert(error.message)
      return []
    }
    return dictionaries.map((dictionary) => {
      return {
        ...dictionary,
        managers: collectionStore<IHelper>(`dictionaries/${dictionary.id}/managers`, noopConstraints),
        contributors: collectionStore<IHelper>(`dictionaries/${dictionary.id}/contributors`, noopConstraints),
        writeInCollaborators: collectionStore<IHelper>(`dictionaries/${dictionary.id}/writeInCollaborators`, noopConstraints),
        invites: collectionStore<IInvite>(`dictionaries/${dictionary.id}/invites`, inviteQueryConstraints),
        getManagers: getCollection<IHelper>(`dictionaries/${dictionary.id}/managers`),
        getContributors: getCollection<IHelper>(`dictionaries/${dictionary.id}/managers`),
        getWriteInCollaborators: getCollection<IHelper>(`dictionaries/${dictionary.id}/writeInCollaborators`),
        getInvites: getCollection<IInvite>(`dictionaries/${dictionary.id}/invites`, inviteQueryConstraints),
      }
    })
  }

  async function update_dictionary(change: TablesUpdate<'dictionaries'> & { id: string }) {
    try {
      await api_update_dictionary(change)
      dictionariesAndHelpers = await get_dictionaries_with_helpers()
    } catch (err) {
      alert(`Error: ${err}`)
    }
  }
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
    <div slot="right" let:filteredItems={filteredDictionaries}>
      <Button
        form="filled"
        color="black"
        onclick={async () => await exportAdminDictionariesAsCSV(filteredDictionaries)}>
        <i class="fas fa-download mr-1" />
        Download {filteredDictionaries.length} Dictionaries as CSV
      </Button>
    </div>
    <div class="mb-1" />
    <div class="custom-scrollbar">
      <ResponsiveTable class="!overflow-unset" stickyHeading stickyColumn>
        <SortDictionaries dictionaries={filteredDictionaries} let:sortedDictionaries>
          {#each sortedDictionaries as dictionary, index (dictionary.id)}
            <IntersectionObserverShared bottom={2000} let:intersecting once>
              <tr>
                {#if intersecting}
                  <DictionaryRow
                    {index}
                    {dictionary}
                    on:toggleprivacy={() => {
                      update_dictionary({
                        id: dictionary.id,
                        public: !dictionary.public,
                      })
                    }}
                    on:addalternatename={(event) => {
                      update_dictionary({
                        id: dictionary.id,
                        alternate_names: [...(dictionary.alternate_names || []), event.detail],
                      })
                    }}
                    on:removealternatename={(event) => {
                      update_dictionary({
                        id: dictionary.id,
                        alternate_names: dictionary.alternate_names.filter(name => name !== event.detail),
                      })
                    }}
                    on:updatecoordinates={({ detail: { lat, lng } }) => {
                      const [, ...rest] = dictionary.coordinates?.points || []
                      update_dictionary({
                        id: dictionary.id,
                        coordinates: {
                          points: [{ coordinates: { latitude: lat, longitude: lng } }, ...rest],
                          regions: dictionary.coordinates?.regions,
                        },
                      })
                    }}
                    on:removecoordinates={() => {
                      const [, ...rest] = dictionary.coordinates?.points || []
                      update_dictionary({
                        id: dictionary.id,
                        coordinates: {
                          points: rest,
                          regions: dictionary.coordinates?.regions,
                        },
                      })
                    }} />
                {:else}
                  <td colspan="30"> Loading... </td>
                {/if}
              </tr>
            </IntersectionObserverShared>
          {/each}
        </SortDictionaries>
      </ResponsiveTable>
    </div>
  </Filter>
</div>

<style>
  .custom-scrollbar {
    scrollbar-width: thin !important;
  }
</style>
