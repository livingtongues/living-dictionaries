<script lang="ts">
  import { canEdit } from '$lib/stores';
  import type { Change } from '@living-dictionaries/types';
  import RecordRow from './RecordRow.svelte';
  import Filter from '$lib/components/Filter.svelte';
  import { downloadObjectsAsCSV } from '$lib/export/csv';
  import { Button, ResponsiveTable } from 'svelte-pieces';
  import SortRecords from './sortRecords.svelte';
  import { getActionValue } from './getActionValue';
  import { printDateTime } from '$lib/helpers/time';

  export let data;

  function exportHistoryAsCSV(records: Change[]) {
    const headers = {
      entryName: 'entry_name',
      updatedName: 'editor',
      action: 'action',
      field: 'field',
      date: 'date',
    };

    const formattedUsers = records.map((record) => {
      return {
        entryName: record.entryName,
        updatedName: record.updatedName,
        action: getActionValue(record),
        field: record.field,
        date: printDateTime(record.updatedAtMs)
      };
    });

    downloadObjectsAsCSV(headers, formattedUsers, '[dictionary-name]-history');
  }
</script>

{#if canEdit}
  <div class="sticky top-0 h-[calc(100vh-1.5rem)] z-2 relative flex flex-col">
    <Filter items={data.history} let:filteredItems={filteredRecords} placeholder="Search entry names, editors and fields"> <!--TODO Translate-->
      <div slot="right">
        <Button form="filled" color="black" onclick={() => exportHistoryAsCSV(filteredRecords)}>
          <i class="fas fa-download mr-1" />
          Download History as CSV
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
{/if}
