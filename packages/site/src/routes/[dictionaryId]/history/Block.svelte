<script lang="ts">
  import type { Change } from '@living-dictionaries/types';

  export let records: Change[];

  function getAction(previousValue: string | string[], currentValue: string | string[]): string {
    if (previousValue?.length === 0)
      return 'created';
    else if (currentValue?.length === 0)
      return 'deleted';

    return 'edited';
  }
</script>

<ul class="m-3 md:text-xl">
  {#each records as record}
    {@const { updatedName, entryId, entryName, dictionaryId, previousValue, currentValue, field, updatedAtMs } = record}
    {@const date = new Date(updatedAtMs)}
    <li class="mb-2">{updatedName} <strong>{getAction(previousValue, currentValue)}</strong> {field} field on <a href="{dictionaryId}/{entryId}">{entryName}</a> on {date.toLocaleString()}</li>
  {/each}
</ul>

<span class="line" />

<style>
  a {
    color: blue;
  }

  .line {
    display: block;
    height: 1px;
    width: 100%;
    border-bottom: dashed 1px gray;
  }
</style>
