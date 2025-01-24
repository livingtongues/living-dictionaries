<script lang="ts">
  import type { IUser } from '@living-dictionaries/types'
  import { Collection } from 'sveltefirets'
  import { Button, ResponsiveTable } from 'svelte-pieces'
  import UserRow from './UserRow.svelte'
  import SortUsers from './SortUsers.svelte'
  import { downloadObjectsAsCSV } from '$lib/export/csv'
  import Filter from '$lib/components/Filter.svelte'

  const usersType: IUser[] = []

  function exportUsersAsCSV(users: IUser[]) {
    const headers = {
      displayName: 'Name',
      email: 'Email',
    }

    const formattedUsers = users.map((user) => {
      return {
        displayName: user.displayName?.replace(/,/, ''),
        email: user.email,
      }
    })

    downloadObjectsAsCSV(headers, formattedUsers, 'livingdictionary-users')
  }
</script>

<Collection path="users" startWith={usersType} let:data={users}>
  <div class="sticky top-0 h-[calc(100vh-1.5rem)] z-2 relative flex flex-col">
    <Filter items={users} let:filteredItems={filteredUsers} placeholder="Search names and emails">
      <div slot="right" let:filteredItems={filteredUsers}>
        <Button form="filled" color="black" onclick={() => exportUsersAsCSV(filteredUsers)}>
          <i class="fas fa-download mr-1" />
          Download {filteredUsers.length} Users as CSV
        </Button>
      </div>
      <div class="mb-1" />
      <ResponsiveTable class="!overflow-unset" stickyColumn stickyHeading>
        <SortUsers users={filteredUsers} let:sortedUsers>
          {#each sortedUsers as user (user.uid)}
            <UserRow {user} />
          {/each}
        </SortUsers>
      </ResponsiveTable>
    </Filter>
  </div>
</Collection>
