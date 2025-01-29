<script lang="ts">
  import type { EntryView, Tables } from '@living-dictionaries/types'
  import { sortedColumn } from './sortedColumnStore'
  import { supabase_date_to_friendly } from '$lib/helpers/time'

  export let record: Tables<'content_updates'>
  export let entry: EntryView
</script>

<tr>
  <td class:font-bold={$sortedColumn === 'entryName'}>
    <a class="underline hover:no-underline text-blue-500 visited:text-purple-500" href="entry/{record.entry_id}" target="_blank">{entry?.main.lexeme.default}</a>
  </td>
  <td class:font-bold={$sortedColumn === 'type'}>
    {`${String(record.change.type)}` || ''}
  </td>
  <td class:font-bold={$sortedColumn === 'field'}>
    {`${JSON.stringify(record.change.data)}` || ''}
  </td>
  <td class:font-bold={$sortedColumn === 'date'}>
    {supabase_date_to_friendly(new Date(record.timestamp)) || ''}
  </td>
</tr>
