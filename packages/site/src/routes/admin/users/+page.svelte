<script lang="ts">
  import type { PageData } from './$types'
  import Filter from '$lib/components/Filter.svelte'
  import { downloadObjectsAsCSV } from '$lib/export/csv'
  import { Button, ResponsiveTable } from '$lib/svelte-pieces'
  import SortUsers from './SortUsers.svelte'
  import UserRow from './UserRow.svelte'

  interface Props {
    data: PageData
  }

  let { data }: Props = $props()
  const users = $derived(data.db.users.rows)
  const user_data = $derived(data.db.user_data.objects)
  const roles = $derived(data.db.dictionary_roles.rows)
  const dictionaries = $derived(data.db.dictionaries.rows)

  let users_with_roles = $derived(
    (users || []).map((user) => {
      return {
        ...user,
        dictionary_roles: (roles || []).filter(role => role.user_id === user.id),
      }
    }),
  )

  function exportUsersAsCSV(users: typeof users_with_roles) {
    const headers = {
      displayName: 'Name',
      email: 'Email',
    }

    const formattedUsers = users.map((user) => {
      return {
        displayName: user.full_name?.replace(/,/, ''),
        email: user.email,
      }
    })

    downloadObjectsAsCSV(headers, formattedUsers, 'livingdictionary-users')
  }
</script>

<div class="sticky top-0 h-[calc(100vh-1.5rem)] z-2 relative flex flex-col">
  <Filter items={users_with_roles} placeholder="Search names and emails">
    {#snippet right({ filteredItems: filteredUsers })}
      <div>
        <Button form="filled" color="black" onclick={() => exportUsersAsCSV(filteredUsers)}>
          <i class="fas fa-download mr-1"></i>
          Download {filteredUsers.length} Users as CSV
        </Button>
      </div>
    {/snippet}
    {#snippet children({ filteredItems: filteredUsers })}
      <div class="mb-1"></div>
      <ResponsiveTable stickyColumn stickyHeading>
        <SortUsers users={filteredUsers}>
          {#snippet children({ sortedUsers })}
            {#each sortedUsers as user (user.id)}
              <UserRow {user} user_data={user_data[user.id]} {dictionaries} />
            {/each}
          {/snippet}
        </SortUsers>
      </ResponsiveTable>
    {/snippet}
  </Filter>
</div>
