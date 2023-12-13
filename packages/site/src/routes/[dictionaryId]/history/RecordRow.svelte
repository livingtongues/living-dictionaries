<script lang="ts">
  import type { Change } from '@living-dictionaries/types';
  import { printDateTime } from '$lib/helpers/time';
  import { getActionValue } from './getActionValue';
  import { page } from '$app/stores';

  export let record: Change;
  const maxNumChar = 150;
</script>

<tr>
  <td>
    <a class="underline hover:no-underline text-blue-500 visited:text-purple-500" href="entry/{record.entryId}" target="_blank">{record.entryName}</a>
  </td>
  <td>
    {record.updatedName}
  </td>
  <td>
    {$page.data.t(`history.${getActionValue(record)}`)}
  </td>
  <td>
    {record.previousValue?.slice(0, maxNumChar)}
  </td>
  <td>
    {record.currentValue?.slice(0, maxNumChar)}
  </td>
  <td>
    {$page.data.t(`entry_field.${record.field}`)}
  </td>
  <td>
    {printDateTime(record.updatedAtMs)}
  </td>
</tr>
