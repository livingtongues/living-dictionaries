<script lang="ts">
  import type { Tables } from '@living-dictionaries/types'
  import { getActionValue } from './getActionValue'
  import { sortedColumn } from './sortedColumnStore'
  import { printDateTime } from '$lib/helpers/time'
  import { page } from '$app/stores'

  export let record: Tables<'content_updates'>
  const maxNumChar = 50
  const htmlRegex = /<[^>]*>/g
</script>

<tr>
  <td class:font-bold={$sortedColumn === 'entryName'}>
    <a class="underline hover:no-underline text-blue-500 visited:text-purple-500" href="entry/{record.entry_id}" target="_blank">{record.id}</a>
  </td>
  <td class:font-bold={$sortedColumn === 'updatedName'}>
    {record.user_id || ''}
  </td>
  <td class:font-bold={$sortedColumn === 'action'}>
    {$page.data.t(`history.${getActionValue(record)}`) || ''}
  </td>
  <!-- <td class:font-bold={$sortedColumn === 'previousValue'}>
    {record.previousValue?.slice(0, maxNumChar).toString().replace(htmlRegex, '') || ''}{#if record.previousValue?.length >= maxNumChar}<a href="entry/{record.entryId}" target="_blank">...</a>{/if}
  </td>
  <td class:font-bold={$sortedColumn === 'currentValue'}>
    {record.currentValue?.slice(0, maxNumChar).toString().replace(htmlRegex, '') || ''}{#if record.currentValue?.length >= maxNumChar}<a href="entry/{record.entryId}" target="_blank">...</a>{/if}
  </td> -->
  <td class:font-bold={$sortedColumn === 'field'}>
    {`${JSON.stringify(record.change.data)}` || ''}
  </td>
  <td class:font-bold={$sortedColumn === 'type'}>
    {`${JSON.stringify(record.change.type)}` || ''}
  </td>
  <td class:font-bold={$sortedColumn === 'date'}>
    {printDateTime(new Date(record.timestamp)) || ''}
  </td>
</tr>
