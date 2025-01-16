<script lang="ts">
  import type { Change } from '@living-dictionaries/types'
  import { getActionValue } from './getActionValue'
  import { downloadObjectsAsCSV } from '$lib/export/csv'
  import { printDateTime } from '$lib/helpers/time'
  import { page } from '$app/stores'

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

    const formattedUsers = records.map((record) => {
      return {
        entryName: record.entryName,
        updatedName: record.updatedName,
        action: $page.data.t(`history.${getActionValue(record)}`),
        previousValue: JSON.stringify(record.previousValue),
        currentValue: JSON.stringify(record.currentValue),
        field: $page.data.t(`entry_field.${record.field}`),
        date: printDateTime(record.updatedAtMs),
      }
    })

    downloadObjectsAsCSV(headers, formattedUsers, `${$dictionary.id}-history`)
  }
</script>

{#if $can_edit}
  <pre>{JSON.stringify(content_updates, null, 2)}</pre>
  {#if content_updates?.length > 0}
    <!-- <div class="sticky top-0 h-[calc(100vh-1.5rem)] z-2 relative flex flex-col">
      <Filter items={content_updates} let:filteredItems={filteredRecords} placeholder={$page.data.t('history.history_search')}>
        <div slot="right">
          <Button form="filled" color="black" class="flex items-center space-x-1" onclick={() => exportHistoryAsCSV(filteredRecords)}>
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
    </div> -->
  {:else}
    {$page.data.t('history.empty')}
  {/if}
{/if}
