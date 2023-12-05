<script lang="ts">
  import type { Change } from '@living-dictionaries/types';
  // import { printDate } from '$lib/helpers/time'; We can use printDate or create another helper function with time

  export let record: Change;
  function getAction(previousValue: string | string[], currentValue: string | string[]): string {
    if (previousValue?.length === 0)
      return 'created';
    else if (currentValue?.length === 0)
      return 'deleted';

    return 'edited';
  }
</script>

<tr>
  <td>
    {record.entryName}
  </td>
  <td>
    {record.updatedName}
  </td>
  <td>
    {getAction(record.previousValue, record.currentValue)}
  </td>
  <td>
    {record.field}
  </td>
  <td>
    {new Date(record.updatedAtMs).toString()}
  </td>
</tr>
