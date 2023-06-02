<script lang="ts">
  import type { IUser } from '@living-dictionaries/types';
  import { Collection } from 'sveltefirets';
  import Filter from '$lib/components/Filter.svelte';
  import { exportUsersAsCSV } from '$lib/export/csv';
  import { Button, ResponsiveTable } from 'svelte-pieces';
  import UserRow from './UserRow.svelte';
  import SortUsers from './SortUsers.svelte';

  let usersType: IUser[] = [];
</script>

<Collection path="users" startWith={usersType} let:data={users}>
  <div class="sticky top-0 h-[calc(100vh-1.5rem)] z-2 relative flex flex-col">
    <Filter items={users} let:filteredItems={filteredUsers} placeholder="Search names and emails">
      <div slot="right">
        <Button
          form="filled"
          color="black"
          onclick={() => exportUsersAsCSV(filteredUsers, 'livingdictionary-users')}>
          <i class="fas fa-download mr-1" />
          Download {filteredUsers.length} Users as CSV
        </Button>
      </div>
      <div class="mb-1" />
      <ResponsiveTable stickyColumn stickyHeading>
        <SortUsers users={filteredUsers} let:sortedUsers>
          {#each sortedUsers as user (user.uid)}
            <UserRow {user} />
          {/each}
        </SortUsers>
      </ResponsiveTable>
    </Filter>
  </div>
</Collection>
