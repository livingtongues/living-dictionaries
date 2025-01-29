<script lang="ts">
  import { Button, ResponsiveTable } from 'svelte-pieces'
  import RecordRow from './RecordRow.svelte'
  import SortRecords from './sortRecords.svelte'
  import { page } from '$app/stores'
  import Filter from '$lib/components/Filter.svelte'
  import { downloadObjectsAsCSV } from '$lib/export/csv'
  import { supabase_date_to_friendly } from '$lib/helpers/time'

  export let data
  const { entries } = $page.data
  // eslint-disable-next-line svelte/no-reactive-functions
  $: get_lexeme = (record) => {
    const [lexeme] = $entries.filter(entry =>
      entry.id === record.entry_id || entry.senses.some(sense => sense.id === record.sense_id))
    return lexeme
  }
  $: ({ dictionary, can_edit, content_updates } = data)

  function exportHistoryAsCSV() {
    const headers = {
      entryName: $page.data.t('history.entry'),
      change: $page.data.t('history.change'),
      type: $page.data.t('history.type'),
      date: $page.data.t('history.date'),
    }

    const formattedUsers = content_updates.map((record) => {
      return {
        entryName: get_lexeme(record)?.main.lexeme.default,
        type: JSON.stringify(record.change.type),
        change: JSON.stringify(record.change.data),
        date: supabase_date_to_friendly(new Date(record.timestamp)),
      }
    })

    downloadObjectsAsCSV(headers, formattedUsers, `${dictionary.id}-history`)
  }
</script>

{#if $can_edit}
  {#if content_updates?.length > 0}
    <div class="sticky top-0 h-[calc(100vh-1.5rem)] flex flex-col">
      <Filter items={content_updates} let:filteredItems={filteredRecords} placeholder={$page.data.t('history.history_search')}>
        <div slot="right">
          <Button form="filled" color="black" class="flex items-center space-x-1" onclick={() => exportHistoryAsCSV()}>
            <i class="fas fa-download" />
            <span class="hidden sm:inline">{$page.data.t('history.download_history')}</span>
          </Button>
        </div>
        <div class="mb-1" />
        <ResponsiveTable stickyColumn stickyHeading>
          <SortRecords history={filteredRecords} let:sortedRecords>
            {#each sortedRecords as record}
              <RecordRow {record} entry={get_lexeme(record)} />
            {/each}
          </SortRecords>
        </ResponsiveTable>
      </Filter>
    </div>
  {:else}
    {$page.data.t('history.empty')}
  {/if}
{/if}
