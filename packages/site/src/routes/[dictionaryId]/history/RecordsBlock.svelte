<script lang="ts">
  import type { Change } from '@living-dictionaries/types';

  export let records: Change[];
  export let selected: 'date' | 'action' | 'editor' | 'lexeme' | 'field' = 'date';

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
    <li class="mb-2"><a href="{dictionaryId}/{entryId}">{entryName}</a>: <span class={selected === 'editor' ? 'highlighted' : ''}>{updatedName}</span> <span class={selected === 'action' ? 'highlighted' : ''}>{getAction(previousValue, currentValue)}</span> a <span class={selected === 'field' ? 'highlighted' : ''}>{field}</span> field on <span class={selected === 'date' ? 'highlighted' : ''}>{date.toLocaleString()}</span></li>
  {/each}
</ul>

<span class="line" />

<style>
  a {
    color: blue;
  }

  .highlighted {
    font-weight: bold;
  }

  .line {
    display: block;
    height: 1px;
    width: 100%;
    border-bottom: dashed 1px gray;
  }
</style>
