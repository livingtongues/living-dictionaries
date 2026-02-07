<script lang="ts">
  import type { PageData } from './$types'
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

  const dictionaries = $derived(data.db?.dictionaries.rows)
  const users = $derived(data.db?.users.rows)
  const roles = $derived(data.db?.dictionary_roles.rows)

  let users_with_roles = $derived(
    (users || []).map((user) => {
      return {
        ...user,
        dictionary_roles: (roles || []).filter(role => role.user_id === user.id),
      }
    }),
  )

  let active_section = $derived(page.url.searchParams.get('filter') as 'public' | 'private' | 'other')

  let active_invites = $derived(
    data.db?.invites.rows.filter(invite => invite.status === 'queued' || invite.status === 'sent') ?? [],
  )

  let dictionaries_with_editors_invites = $derived(
    (dictionaries || [])
      .filter((dictionary) => {
        if (active_section === 'public') return dictionary.public
        if (active_section === 'private') return !dictionary.public && !dictionary.con_language_description
        if (active_section === 'other') return !dictionary.public && dictionary.con_language_description
        return false
      })
      .map((dictionary) => {
        const extra = {
          editors: users_with_roles.filter(user => user.dictionary_roles.some(role => role.dictionary_id === dictionary.id)),
          invites: active_invites.filter(invite => invite.dictionary_id === dictionary.id),
        }
        return new Proxy(dictionary, {
          get(target, prop, receiver) {
            if (prop in extra) return extra[prop as keyof typeof extra]
            return Reflect.get(target, prop, receiver)
          },
          set(target, prop, value, receiver) {
            return Reflect.set(target, prop, value, receiver)
          },
        }) as typeof dictionary & typeof extra
      }),
  )
</script>

<div class="mb-2 text-xs text-gray-600 flex">
  <div>
    Changed data saves locally on change. Use "tab" to quickly move between cells. Click the "Sync" button when done to save changes to the server.
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
          onclick={() => exportAdminDictionariesAsCSV(filteredDictionaries, active_section)}>
          <i class="fas fa-download mr-1"></i>
          Download {filteredDictionaries.length} Dictionaries as CSV
        </Button>
      </div>
    {/snippet}
    {#snippet children({ filteredItems: filteredDictionaries })}
      <div class="mb-1"></div>
      <ResponsiveTable stickyHeading stickyColumn>
        <SortDictionaries dictionaries={filteredDictionaries}>
          {#snippet children({ sortedDictionaries })}
            {#each sortedDictionaries as dictionary, index (dictionary.id)}
              <IntersectionObserverShared bottom={4000} once>
                {#snippet children({ intersecting })}
                  <tr>
                    {#if intersecting}
                      <DictionaryRow
                        {index}
                        {dictionary}
                        users={users_with_roles}
                        is_public={active_section === 'public'} />
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
