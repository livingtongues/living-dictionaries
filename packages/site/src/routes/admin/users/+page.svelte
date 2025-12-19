<script lang="ts">
  import { Button, ResponsiveTable } from 'svelte-pieces'
  import type { UserWithDictionaryRoles } from '@living-dictionaries/types/supabase/users.types'
  import UserRow from './UserRow.svelte'
  import SortUsers from './SortUsers.svelte'
  import type { PageData } from './$types'
  import { downloadObjectsAsCSV } from '$lib/export/csv'
  import Filter from '$lib/components/Filter.svelte'

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
  let { admin_dictionaries, users, dictionary_roles } = $derived(data)

  let users_with_roles = $derived($users.map((user) => {
    return {
      ...user,
      dictionary_roles: $dictionary_roles.filter(role => role.user_id === user.id),
    }
  }))

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
  <Filter items={users_with_roles}  placeholder="Search names, emails, and dictionary ids">
    {#snippet right({ filteredItems: filteredUsers })}
        <div  >
        <Button form="filled" color="black" onclick={() => exportUsersAsCSV(filteredUsers)}>
          <i class="fas fa-download mr-1"></i>
          Download {filteredUsers.length} Users as CSV
        </Button>
      </div>
      {/snippet}
    {#snippet children({ filteredItems: filteredUsers })}
        <div class="mb-1"></div>
      <ResponsiveTable stickyColumn stickyHeading>
        <SortUsers users={filteredUsers} >
          {#snippet children({ sortedUsers })}
                {#each sortedUsers as user (user.id)}
              <UserRow
                load_data={async () => {
                  await Promise.all([
                    users.refresh(),
                    dictionary_roles.reset(),
                  ])
                }}
                dictionaries={$admin_dictionaries}
                {user} />
            {/each}
                        {/snippet}
            </SortUsers>
      </ResponsiveTable>
          {/snippet}
    </Filter>
</div>
