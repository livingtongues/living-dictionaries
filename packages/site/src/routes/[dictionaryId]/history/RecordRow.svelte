<script lang="ts">
  import type { Change } from '@living-dictionaries/types';
  import { printDateTime } from '$lib/helpers/time';
  import { getActionValue } from './getActionValue';

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
    {getActionValue(record)}
  </td>
  <td>
    {record.previousValue}
  </td>
  <td>
    {record.currentValue}
  </td>
  <td>
    {record.field}
  </td>
  <td>
    {printDateTime(record.updatedAtMs)}
  </td>
</tr>
