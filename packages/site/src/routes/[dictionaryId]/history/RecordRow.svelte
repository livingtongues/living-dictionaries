<script lang="ts">
  import type { Change } from '@living-dictionaries/types';
  import { printDateTime } from '$lib/helpers/time';
  import { getActionValue } from './getActionValue';
  import { page } from '$app/stores';

  export let record: Change;
</script>

<tr>
  <td>
    {record.entryName}
  </td>
  <td>
    {record.updatedName}
  </td>
  <td>
    {$page.data.t(`history.${getActionValue(record)}`)}
  </td>
  <td>
    {record.previousValue}
  </td>
  <td>
    {record.currentValue}
  </td>
  <td>
    {$page.data.t(`entry_field.${record.field}`)}
  </td>
  <td>
    {printDateTime(record.updatedAtMs)}
  </td>
</tr>
