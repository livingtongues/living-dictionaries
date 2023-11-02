<script lang="ts">
  import type { History } from '@living-dictionaries/types';
  export let history: History[];
  export let canEdit = false;
</script>

<div class="{$$props.class} text-gray-500">
  {#if canEdit}
    <strong>Lexeme history:</strong>
    {#each history as record}
      <!-- TODO it could be better to query only lexeme records-->
      {#if window.location.pathname.match(record.entryId)}
        <p class="m-3">{record.editor} edited this entry on {record.updatedAt.toDate().toLocaleString()}</p>
      {/if}
    {/each}
  {:else}
    <p class="m-3">Last edited on {history[0].updatedAt.toDate().toLocaleString()}</p>
  {/if}
</div>
