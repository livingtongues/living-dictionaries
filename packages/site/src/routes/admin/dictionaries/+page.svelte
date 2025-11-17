<script lang="ts">
  import type { Tables, TablesUpdate } from '@living-dictionaries/types'
  import { Button, IntersectionObserverShared, ResponsiveTable } from 'svelte-pieces'
  import { writable } from 'svelte/store'
  import { onMount } from 'svelte'
  import DictionaryRow from './DictionaryRow.svelte'
  import SortDictionaries from './SortDictionaries.svelte'
  import { exportAdminDictionariesAsCSV } from './export'
  import type { PageData } from './$types'
  import type { DictionaryWithHelpers } from './dictionaryWithHelpers.types'
  import Filter from '$lib/components/Filter.svelte'
  import { page } from '$app/stores'

  export let data: PageData
  $: ({ users, dictionary_roles, admin_dictionaries } = data)

  $: users_with_roles = $users.map((user) => {
    return {
      ...user,
      dictionary_roles: $dictionary_roles.filter(role => role.user_id === user.id),
    }
  })

  $: active_section = $page.url.searchParams.get('filter') as 'public' | 'private' | 'other'

  const invites = writable<Tables<'invites'>[]>([])

  $: dictionaries_with_editors_invites = $admin_dictionaries
    // eslint-disable-next-line array-callback-return
    .filter((dictionary) => {
      if (active_section === 'public') return dictionary.public
      if (active_section === 'private') return !dictionary.public && !dictionary.con_language_description
      if (active_section === 'other') return !dictionary.public && dictionary.con_language_description
    })
    .map((dictionary) => {
      return {
        ...dictionary,
        editors: users_with_roles.filter(user => user.dictionary_roles.some(role => role.dictionary_id === dictionary.id)),
        invites: $invites.filter(invite => invite.dictionary_id === dictionary.id),
      } as DictionaryWithHelpers
    })

  onMount(() => {
    load_extras()
  })

  async function load_extras() {
    const _invites = await data.get_invites()
    invites.set(_invites)
    dictionary_roles.refresh()
  }

  async function update_dictionary(change: TablesUpdate<'dictionaries'>, dictionary_id: string) {
    try {
      const { error } = await data.supabase.from('dictionaries').update(change)
        .eq('id', dictionary_id)
      if (error) throw new Error(error.message)
      await admin_dictionaries.refresh()
    } catch (err) {
      alert(`Error: ${err}`)
    }
  }

  function asDictionaries(items: unknown[]): DictionaryWithHelpers[] {
    return items as DictionaryWithHelpers[]
  }
</script>

<div class="mb-2 text-xs text-gray-600 flex">
  <div>
    Changed data autosaves after 2 seconds. Green cells = data that's not saved. Use "tab" to quickly
    move between cells.
  </div>
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
        onclick={() => exportAdminDictionariesAsCSV(asDictionaries(filteredDictionaries), active_section)}>
        <i class="fas fa-download mr-1" />
        Download {filteredDictionaries.length} Dictionaries as CSV
      </Button>
    </div>
    <div class="mb-1" />
    <ResponsiveTable stickyHeading stickyColumn>
      <SortDictionaries dictionaries={asDictionaries(filteredDictionaries)} let:sortedDictionaries>
        {#each sortedDictionaries as dictionary, index (dictionary.id)}
          <IntersectionObserverShared bottom={4000} let:intersecting once>
            <tr>
              {#if intersecting}
                <DictionaryRow
                  {index}
                  {dictionary}
                  users={users_with_roles}
                  is_public={active_section === 'public'}
                  update_dictionary={async change => await update_dictionary(change, dictionary.id)}
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
