<script lang="ts">
  import type { UserWithDictionaryRoles } from '@living-dictionaries/types/supabase/users.types'
  import Filter from '$lib/components/Filter.svelte'
  import { downloadObjectsAsCSV } from '$lib/export/csv'
  import { Button, ResponsiveTable } from '$lib/svelte-pieces'
  import SortUsers from './SortUsers.svelte'
  import UserRow from './UserRow.svelte'

  let { data } = $props()

  let users_with_roles = $derived(
    (data.db?.users.rows ?? []).map((user) => {
      return {
        ...user,
        dictionary_roles: (data.db?.dictionary_roles.rows ?? []).filter(role => role.user_id === user.id),
      } // as UserWithDictionaryRoles
    }),
  )

  function exportUsersAsCSV(users: UserWithDictionaryRoles[]) {
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
  <Filter items={users_with_roles} placeholder="Search names, emails, and dictionary ids">
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
              <UserRow {user} />
            {/each}
          {/snippet}
        </SortUsers>
      </ResponsiveTable>
    {/snippet}
  </Filter>
</div>
