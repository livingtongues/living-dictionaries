<script lang="ts">
  // import { canEdit } from '$lib/stores';
  import RecordRow from './RecordRow.svelte';
  import Filter from '$lib/components/Filter.svelte';
  // import { downloadObjectsAsCSV } from '$lib/export/csv';
  import { Button, ResponsiveTable } from 'svelte-pieces';
  import SortRecords from './sortRecords.svelte';

  export let data;

// function exportUsersAsCSV(users: IUser[]) {
  //   const headers = {
  //     displayName: 'Name',
  //     email: 'Email',
  //   };

  //   const formattedUsers = users.map((user) => {
  //     return {
  //       displayName: user.displayName?.replace(/,/, ''),
  //       email: user.email,
  //     };
  //   });

  //   downloadObjectsAsCSV(headers, formattedUsers, 'livingdictionary-users');
  // }
</script>

<div class="sticky top-0 h-[calc(100vh-1.5rem)] z-2 relative flex flex-col">
  <Filter items={data.history} let:filteredItems={filteredRecords} placeholder="">
    <div slot="right">
      <Button form="filled" color="black">
        <i class="fas fa-download mr-1" />
        Download {filteredRecords.length} History as CSV
      </Button>
    </div>
    <div class="mb-1" />
    <ResponsiveTable stickyColumn stickyHeading>
      <SortRecords history={filteredRecords} let:sortedRecords>
        {#each sortedRecords as record}
          <RecordRow {record} />
        {/each}
      </SortRecords>
    </ResponsiveTable>
  </Filter>
</div>
