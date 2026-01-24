<script lang="ts">
  import { Button, ResponsiveTable } from '$lib/svelte-pieces'
  import type { EntryData, Tables } from '@living-dictionaries/types'
  import { onMount } from 'svelte'
  import RecordRow from './RecordRow.svelte'
  import SortRecords from './sortRecords.svelte'
  import type { PageData } from './$types'
  import { page } from '$app/state'
  import Filter from '$lib/components/Filter.svelte'
  import { downloadObjectsAsCSV } from '$lib/export/csv'
  import { supabase_date_to_friendly } from '$lib/helpers/time'

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
  let loading_content_updates = $state(true)
  const { entries_data } = page.data
  let { dictionary, can_edit, get_content_updates } = $derived(data)

  let content_updates: Tables<'content_updates'>[] = $state([])
  onMount(() => {
    const unsub = entries_data.loading.subscribe(async (loading) => {
      if (!loading) {
        content_updates = await get_content_updates()
        unsub()
      }
      loading_content_updates = loading
    })
  })

  function get_entry(record: Tables<'content_updates'>): EntryData {
    const entry = $entries_data[record.entry_id]
    if (entry) return entry

    return Object.values($entries_data).find(entry =>
      entry.senses.some(sense => sense.id === record.sense_id))
  }

  function exportHistoryAsCSV() {
    const headers = {
      entryName: page.data.t('history.entry'),
      change: page.data.t('history.change'),
      type: page.data.t('history.type'),
      date: page.data.t('history.date'),
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
      <Filter items={content_updates}  placeholder={page.data.t('history.history_search')}>
        {#snippet right()}
                <div >
            <Button form="filled" color="black" class="flex items-center space-x-1" onclick={() => exportHistoryAsCSV()}>
              <i class="fas fa-download"></i>
              <span class="hidden sm:inline">{page.data.t('history.download_history')}</span>
            </Button>
          </div>
              {/snippet}
        {#snippet children({ filteredItems: filteredRecords })}
                <div class="mb-1"></div>
          <ResponsiveTable stickyColumn stickyHeading>
            <SortRecords history={filteredRecords}  {get_entry}>
              {#snippet children({ sortedRecords })}
                        {#each sortedRecords as record}
                  <RecordRow {record} {get_entry} />
                {/each}
                                    {/snippet}
                    </SortRecords>
          </ResponsiveTable>
                      {/snippet}
            </Filter>
    </div>
  {:else if loading_content_updates}
    {page.data.t('misc.loading')}...
  {:else}
    {page.data.t('history.empty')}
  {/if}
{/if}
