<script lang="ts">
  import type { IUser } from '@ld/types';
  import { Collection } from '$sveltefirets';
  import UserRow from './_UserRow.svelte';
  import Filter from './_Filter.svelte';
  import { exportUsersAsCSV } from '$lib/export/csv';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import ResponsiveTable from '$lib/components/ui/ResponsiveTable.svelte';
  import SortUsers from './_SortUsers.svelte';

  let usersType: IUser[] = [];
</script>

<Collection path="users" startWith={usersType} let:data={users}>
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
    <ResponsiveTable class="my-1">
      <SortUsers users={filteredUsers} let:sortedUsers>
        {#each sortedUsers as user (user.uid)}
          <UserRow {user} />
        {/each}
      </SortUsers>
    </ResponsiveTable>
  </Filter>
</Collection>
