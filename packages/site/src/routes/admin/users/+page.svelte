<script lang="ts">
  import { Button, ResponsiveTable } from 'svelte-pieces'
  import { onMount } from 'svelte'
  import type { UserWithDictionaryRoles } from '@living-dictionaries/types/supabase/users.types'
  import UserRow from './UserRow.svelte'
  import SortUsers from './SortUsers.svelte'
  import type { PageData } from './$types'
  import { downloadObjectsAsCSV } from '$lib/export/csv'
  import Filter from '$lib/components/Filter.svelte'

  export let data: PageData
  $: ({ public_dictionaries, private_dictionaries, other_dictionaries } = data)

  let users: UserWithDictionaryRoles[] = []
  $: dictionaries = [...$public_dictionaries, ...$private_dictionaries, ...$other_dictionaries]

  onMount(load_data)

  async function load_data() {
    users = await data.get_users_with_roles()
  }

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
  <Filter items={users} let:filteredItems={filteredUsers} placeholder="Search names, emails, and dictionary ids">
    <div slot="right" let:filteredItems={filteredUsers}>
      <Button form="filled" color="black" onclick={() => exportUsersAsCSV(filteredUsers)}>
        <i class="fas fa-download mr-1" />
        Download {filteredUsers.length} Users as CSV
      </Button>
    </div>
    <div class="mb-1" />
    <ResponsiveTable class="md:!overflow-unset" stickyColumn stickyHeading>
      <SortUsers users={filteredUsers} let:sortedUsers>
        {#each sortedUsers as user (user.id)}
          <UserRow {load_data} {dictionaries} {user} />
        {/each}
      </SortUsers>
    </ResponsiveTable>
  </Filter>
</div>
