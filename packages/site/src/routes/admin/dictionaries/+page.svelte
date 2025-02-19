<script lang="ts">
  import type { TablesUpdate } from '@living-dictionaries/types'
  import { Button, IntersectionObserverShared, ResponsiveTable } from 'svelte-pieces'
  import type { UserWithDictionaryRoles } from '@living-dictionaries/types/supabase/users.types'
  import DictionaryRow from './DictionaryRow.svelte'
  import SortDictionaries from './SortDictionaries.svelte'
  import { exportAdminDictionariesAsCSV } from './export'
  import type { PageData } from './$types'
  import type { DictionaryWithHelpers } from './dictionaryWithHelpers.types'
  import Filter from '$lib/components/Filter.svelte'
  import { browser } from '$app/environment'
  import { page } from '$app/stores'

  export let data: PageData

  let dictionaries_with_editors_invites: DictionaryWithHelpers[] = []
  let users: UserWithDictionaryRoles[] = []

  $: active_section = $page.url.searchParams.get('filter') as 'public' | 'private' | 'other'

  $: if (browser) {
    get_dictionaries_with_editors_invites(active_section).then(dictionaries => dictionaries_with_editors_invites = dictionaries)
  }

  async function get_dictionaries_with_editors_invites(section: 'public' | 'private' | 'other') {
    const dictionaries_function = section === 'private' ? data.get_private_dictionaries : section === 'other' ? data.get_other_dictionaries : data.get_public_dictionaries

    const [dictionaries, users_with_roles, invites] = await Promise.all([
      dictionaries_function(),
      data.get_users_with_roles(),
      data.get_invites(),
    ])
    users = users_with_roles

    return dictionaries.map((dictionary) => {
      return {
        ...dictionary,
        editors: users_with_roles.filter(user => user.dictionary_roles.some(role => role.dictionary_id === dictionary.id)),
        invites: invites.filter(invite => invite.dictionary_id === dictionary.id),
      }
    })
  }

  async function update_dictionary(change: TablesUpdate<'dictionaries'>, dictionary_id: string) {
    try {
      const { error } = await data.supabase.from('dictionaries').update(change)
        .eq('id', dictionary_id)
      if (error) throw new Error(error.message)
      dictionaries_with_editors_invites = await get_dictionaries_with_editors_invites(active_section)
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
    items={dictionaries_with_editors_invites}
    let:filteredItems={filteredDictionaries}
    placeholder="Search dictionaries">
    <div slot="right" let:filteredItems={filteredDictionaries}>
      <Button
        form="filled"
        color="black"
        onclick={() => exportAdminDictionariesAsCSV(filteredDictionaries)}>
        <i class="fas fa-download mr-1" />
        Download {filteredDictionaries.length} Dictionaries as CSV
      </Button>
    </div>
    <div class="mb-1" />
    <ResponsiveTable class="md:!overflow-unset" stickyHeading stickyColumn>
      <SortDictionaries dictionaries={filteredDictionaries} let:sortedDictionaries>
        {#each sortedDictionaries as dictionary, index (dictionary.id)}
          <IntersectionObserverShared bottom={2000} let:intersecting once>
            <tr>
              {#if intersecting}
                <DictionaryRow
                  {index}
                  {dictionary}
                  {users}
                  update_dictionary={change => update_dictionary(change, dictionary.id)}
                  load_data={async () => {
                    dictionaries_with_editors_invites = await get_dictionaries_with_editors_invites(active_section)
                  }} />
              {:else}
                <td colspan="30"> Loading... </td>
              {/if}
            </tr>
          </IntersectionObserverShared>
        {/each}
      </SortDictionaries>
    </ResponsiveTable>
  </Filter>
</div>
