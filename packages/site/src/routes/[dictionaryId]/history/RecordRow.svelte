<script lang="ts">
  import type { Tables } from '@living-dictionaries/types'
  import { sortedColumn } from './sortedColumnStore'
  import { supabase_date_to_friendly } from '$lib/helpers/time'
  import { page } from '$app/stores'
  import type { EntryData } from '$lib/search/types'

  export let record: Tables<'content_updates'>
  export let get_entry: (record: Tables<'content_updates'>) => EntryData
</script>

<tr>
  <td class:font-bold={$sortedColumn === 'entryName'}>
    <a class="underline hover:no-underline text-blue-500 visited:text-purple-500" href="entry/{record.entry_id}" target="_blank">{get_entry(record)?.main.lexeme.default || '__'}</a>
  </td>
  <td class:font-bold={$sortedColumn === 'type'}>
    {`${String(record.change.type)}` || ''}
  </td>
  <td class:font-bold={$sortedColumn === 'field'}>
    {`${JSON.stringify(record.change.data)}` || ''}
  </td>
  <td class="md:w-32" class:font-bold={$sortedColumn === 'date'}>
    {supabase_date_to_friendly(record.timestamp, $page.data.locale) || ''}
  </td>
</tr>
