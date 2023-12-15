<script lang="ts">
  import type { Change } from '@living-dictionaries/types';
  import { printDateTime } from '$lib/helpers/time';
  import { getActionValue } from './getActionValue';
  import { page } from '$app/stores';
  import { sortedColumn } from './sortedColumnStore';

  export let record: Change;
  const maxNumChar = 150;
</script>

<tr>
  <td class:font-bold={$sortedColumn === 'entryName'}>
    <a class="underline hover:no-underline text-blue-500 visited:text-purple-500" href="entry/{record.entryId}" target="_blank">{record.entryName}</a>
  </td>
  <td class:font-bold={$sortedColumn === 'updatedName'}>
    {record.updatedName || ''}
  </td>
  <td class:font-bold={$sortedColumn === 'action'}>
    {$page.data.t(`history.${getActionValue(record)}`) || ''}
  </td>
  <td class:font-bold={$sortedColumn === 'previousValue'}>
    {record.previousValue?.slice(0, maxNumChar) || ''}
  </td>
  <td class:font-bold={$sortedColumn === 'currentValue'}>
    {record.currentValue?.slice(0, maxNumChar) || ''}
  </td>
  <td class:font-bold={$sortedColumn === 'field'}>
    {$page.data.t(`entry_field.${record.field}`) || ''}
  </td>
  <td class:font-bold={$sortedColumn === 'date'}>
    {printDateTime(record.updatedAtMs) || ''}
  </td>
</tr>
