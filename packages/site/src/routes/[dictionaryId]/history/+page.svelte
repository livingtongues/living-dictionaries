<script lang="ts">
  import type { Change } from '@living-dictionaries/types'
  import { Button, ResponsiveTable } from 'svelte-pieces'
  import RecordRow from './RecordRow.svelte'
  import SortRecords from './sortRecords.svelte'
  import { page } from '$app/stores'
  import Filter from '$lib/components/Filter.svelte'

  export let data
  $: ({ dictionary, can_edit, content_updates } = data)

  function exportHistoryAsCSV(records: Change[]) {
    const headers = {
      entryName: $page.data.t('history.entry'),
      updatedName: $page.data.t('history.editor'),
      action: $page.data.t('history.action'),
      previousValue: $page.data.t('history.old_value'),
      currentValue: $page.data.t('history.new_value'),
      field: $page.data.t('history.field'),
      date: $page.data.t('history.date'),
    }

    const formattedUsers = content_updates.map((record) => {
      return {
        entryName: record.entry_id,
      // updatedName: record.updatedName,
        // action: $page.data.t(`history.${getActionValue(record)}`),
        // previousValue: JSON.stringify(record.previousValue),
        // currentValue: JSON.stringify(record.currentValue),
        // field: $page.data.t(`entry_field.${record.field}`),
        // date: printDateTime(record.updatedAtMs),
      }
    })

  // downloadObjectsAsCSV(headers, formattedUsers, `${$dictionary.id}-history`)
  }
</script>

{#if $can_edit}
  {#if content_updates?.length > 0}
    <!-- <pre>{JSON.stringify(content_updates, null, 2)}</pre> -->
    <div class="sticky top-0 h-[calc(100vh-1.5rem)] z-2 relative flex flex-col">
      <Filter items={content_updates} let:filteredItems={filteredRecords} placeholder={$page.data.t('history.history_search')}>
        <div slot="right">
          <Button form="filled" color="black" class="flex items-center space-x-1" onclick={() => console.info('exportHistoryAsCSV(filteredRecords) will be exported')}>
            <i class="fas fa-download" />
            <span class="hidden sm:inline">{$page.data.t('history.download_history')}</span>
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
  {:else}
    {$page.data.t('history.empty')}
  {/if}
{/if}
