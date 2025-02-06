<script lang="ts">
  import { Button, ResponsiveTable } from 'svelte-pieces'
  import type { EntryView, Tables } from '@living-dictionaries/types'
  import { onMount } from 'svelte'
  import RecordRow from './RecordRow.svelte'
  import SortRecords from './sortRecords.svelte'
  import type { PageData } from './$types'
  import { page } from '$app/stores'
  import Filter from '$lib/components/Filter.svelte'
  import { downloadObjectsAsCSV } from '$lib/export/csv'
  import { supabase_date_to_friendly } from '$lib/helpers/time'

  export let data: PageData
  let loading_content_updates = true
  const { entries } = $page.data
  $: ({ dictionary, can_edit, get_content_updates } = data)

  let content_updates: Tables<'content_updates'>[] = []
  onMount(() => {
    const usnub = entries.loading.subscribe(async (loading) => {
      loading_content_updates = loading
      if (!loading) {
        content_updates = await get_content_updates()
        usnub()
      }
    })
  })

  function get_entry(record: Tables<'content_updates'>): EntryView {
    return $entries.find(entry =>
      entry.id === record.entry_id || entry.senses.some(sense => sense.id === record.sense_id))
  }

  function exportHistoryAsCSV() {
    const headers = {
      entryName: $page.data.t('history.entry'),
      change: $page.data.t('history.change'),
      type: $page.data.t('history.type'),
      date: $page.data.t('history.date'),
    }

    const formattedUsers = content_updates.map((record) => {
      return {
        entryName: get_entry(record)?.main.lexeme.default,
        type: JSON.stringify(record.change.type),
        change: JSON.stringify(record.change.data),
        date: supabase_date_to_friendly(record.timestamp),
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
          <SortRecords history={filteredRecords} let:sortedRecords {get_entry}>
            {#each sortedRecords as record}
              <RecordRow {record} {get_entry} />
            {/each}
          </SortRecords>
        </ResponsiveTable>
      </Filter>
    </div>
  {:else if loading_content_updates}
    {$page.data.t('misc.loading')}...
  {:else}
    {$page.data.t('history.empty')}
  {/if}
{/if}
