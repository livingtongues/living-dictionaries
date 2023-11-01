<script lang="ts">
  import type { History } from '@living-dictionaries/types';

  export let records: History[];
</script>

<ul class="m-3 md:text-xl">
  {#each records as record}
    {@const { editor, editedLexeme, editedDictionaryId, action, updatedAt } = record}
    {@const date = updatedAt.toDate()}
    <li class="mb-2">{editor} <strong>{action}</strong> <a href="{editedDictionaryId}/{editedLexeme}">{editedLexeme}</a> on {date.toLocaleString()}</li>
  {/each}
</ul>

<span class="line" />

<style>
  .line {
    display: block;
    height: 1px;
    width: 100%;
    border-bottom: dashed 1px gray;
  }
</style>
