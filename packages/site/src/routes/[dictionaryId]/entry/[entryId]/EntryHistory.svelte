<script lang="ts">
  import { canEdit } from '$lib/stores';
  import type { History } from '@living-dictionaries/types';
  export let history: History[];
</script>

<div class="{$$props.class} text-gray-500">
  {#if canEdit}
    <strong>Lexeme history:</strong>
    {#each history as record}
      <!-- TODO it could be better to query only lexeme records-->
      {#if window.location.pathname.match(record.editedLexeme)}
        <p class="m-3">{record.editor} edited this entry on {record.updatedAt.toDate().toLocaleString()}</p>
      {/if}
    {/each}
  {:else}
    <p class="m-3">Last edited on {history[history.length-1].updatedAt.toDate().toLocaleString()}</p>
  {/if}
</div>
