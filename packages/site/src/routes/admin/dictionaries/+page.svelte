<script lang="ts">
  import type { Tables, TablesUpdate } from '@living-dictionaries/types'
  import { Button, IntersectionObserverShared, ResponsiveTable } from 'svelte-pieces'
  import type { UserWithDictionaryRoles } from '@living-dictionaries/types/supabase/users.types'
  import { writable } from 'svelte/store'
  import { onMount } from 'svelte'
  import DictionaryRow from './DictionaryRow.svelte'
  import SortDictionaries from './SortDictionaries.svelte'
  import { exportAdminDictionariesAsCSV } from './export'
  import type { PageData } from './$types'
  import Filter from '$lib/components/Filter.svelte'
  import { page } from '$app/stores'

  export let data: PageData

  $: active_section = $page.url.searchParams.get('filter') as 'public' | 'private' | 'other'

  let dictionaries = data.public_dictionaries
  $: dictionaries = active_section === 'private'
    ? data.private_dictionaries
    : active_section === 'other'
    ? data.other_dictionaries
    : data.public_dictionaries

  const users = writable<UserWithDictionaryRoles[]>([])
  const invites = writable<Tables<'invites'>[]>([])

  $: dictionaries_with_editors_invites = $dictionaries.map((dictionary) => {
    return {
      ...dictionary,
      editors: $users.filter(user => user.dictionary_roles.some(role => role.dictionary_id === dictionary.id)),
      invites: $invites.filter(invite => invite.dictionary_id === dictionary.id),
    }
  })

  onMount(() => {
    load_extras()
  })

  async function load_extras() {
    const [_users, _invites] = await Promise.all([
      data.get_users_with_roles(),
      data.get_invites(),
    ])
    users.set(_users)
    invites.set(_invites)
  }

  async function update_dictionary(change: TablesUpdate<'dictionaries'>, dictionary_id: string) {
    try {
      const { error } = await data.supabase.from('dictionaries').update(change)
        .eq('id', dictionary_id)
      if (error) throw new Error(error.message)
      await dictionaries.refresh()
    } catch (err) {
      alert(`Error: ${err}`)
    }
  }
</script>

<div class="mb-2 text-xs text-gray-600 flex">
  <div>
    Changed data autosaves after 2 seconds. Green cells = data that's not saved. Use "tab" to quickly
    move between cells.
  </div>

  <Button
    type="button"
    class="ml-auto !py-1 -mt-1"
    size="sm"
    form="simple"
    onclick={async () => {
      await data.private_dictionaries.reset()
      await data.public_dictionaries.reset()
      await data.other_dictionaries.reset()
      location.reload()
    }}>Reset cache (after public/private toggle)</Button>
</div>

<div class="sticky top-0 h-[calc(100vh-1.5rem)] z-2 relative flex flex-col">
  <Filter
    items={dictionaries_with_editors_invites || []}
    let:filteredItems={filteredDictionaries}
    placeholder="Search dictionaries and users">
    <div slot="right" let:filteredItems={filteredDictionaries}>
      <Button
        form="filled"
        color="black"
        onclick={() => exportAdminDictionariesAsCSV(filteredDictionaries, active_section)}>
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
                  users={$users}
                  update_dictionary={change => update_dictionary(change, dictionary.id)}
                  {load_extras} />
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
