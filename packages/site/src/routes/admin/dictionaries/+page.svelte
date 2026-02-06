<script lang="ts">
  import type { TablesUpdate } from '@living-dictionaries/types'
  import type { PageData } from './$types'
  import type { DictionaryWithHelpers } from './dictionaryWithHelpers.types'
  import { page } from '$app/state'
  import Filter from '$lib/components/Filter.svelte'
  import { Button, IntersectionObserverShared, ResponsiveTable } from '$lib/svelte-pieces'
  import DictionaryRow from './DictionaryRow.svelte'
  import { exportAdminDictionariesAsCSV } from './export'
  import SortDictionaries from './SortDictionaries.svelte'

  interface Props {
    data: PageData
  }

  let { data }: Props = $props()

  let users_with_roles = $derived(
    data.db?.users.rows.map((user) => {
      return {
        ...user,
        dictionary_roles: data.db?.dictionary_roles.rows.filter(role => role.user_id === user.id) ?? [],
      }
    }) ?? [],
  )

  let active_section = $derived(page.url.searchParams.get('filter') as 'public' | 'private' | 'other')

  let active_invites = $derived(
    data.db?.invites.rows.filter(invite => invite.status === 'queued' || invite.status === 'sent') ?? [],
  )

  let dictionaries_with_editors_invites = $derived(
    (data.db?.dictionaries.rows ?? [])
      .filter((dictionary) => {
        if (active_section === 'public') return dictionary.public
        if (active_section === 'private') return !dictionary.public && !dictionary.con_language_description
        if (active_section === 'other') return !dictionary.public && dictionary.con_language_description
      })
      .map((dictionary) => {
        return {
          ...dictionary,
          editors: users_with_roles.filter(user => user.dictionary_roles.some(role => role.dictionary_id === dictionary.id)),
          invites: active_invites.filter(invite => invite.dictionary_id === dictionary.id),
        } as unknown as DictionaryWithHelpers
      }),
  )

  async function update_dictionary(change: TablesUpdate<'dictionaries'>, dictionary_id: string) {
    const dictionary = data.db?.dictionaries.rows.find(d => d.id === dictionary_id)
    if (!dictionary) return
    Object.assign(dictionary, change)
    await dictionary._save()
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

    placeholder="Search dictionaries and users">
    {#snippet right({ filteredItems: filteredDictionaries })}
      <div>
        <Button
          form="filled"
          color="black"
          onclick={() => exportAdminDictionariesAsCSV(asDictionaries(filteredDictionaries), active_section)}>
          <i class="fas fa-download mr-1"></i>
          Download {filteredDictionaries.length} Dictionaries as CSV
        </Button>
      </div>
    {/snippet}
    {#snippet children({ filteredItems: filteredDictionaries })}
      <div class="mb-1"></div>
      <ResponsiveTable stickyHeading stickyColumn>
        <SortDictionaries dictionaries={asDictionaries(filteredDictionaries)}>
          {#snippet children({ sortedDictionaries })}
            {#each sortedDictionaries as dictionary, index (dictionary.id)}
              <IntersectionObserverShared bottom={4000} once>
                {#snippet children({ intersecting })}
                  <tr>
                    {#if intersecting}
                      <DictionaryRow
                        {index}
                        {dictionary}
                        users={users_with_roles as any}
                        is_public={active_section === 'public'}
                        update_dictionary={async change => await update_dictionary(change, dictionary.id)} />
                    {:else}
                      <td colspan="30"> Loading... </td>
                    {/if}
                  </tr>
                {/snippet}
              </IntersectionObserverShared>
            {/each}
          {/snippet}
        </SortDictionaries>
      </ResponsiveTable>
    {/snippet}
  </Filter>
</div>
