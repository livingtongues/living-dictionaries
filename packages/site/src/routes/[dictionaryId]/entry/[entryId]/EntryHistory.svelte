<script lang="ts">
  import type { History } from '@living-dictionaries/types';
  export let history: History[];
</script>

<div class="{$$props.class} text-gray-500">
  <strong>Lexeme history:</strong>
  {#each history as record}
    {#if window.location.pathname.match(record.editedLexeme)}
      <p class="m-3">{record.editor} edited this entry on {record.updatedAt.toDate().toLocaleString()}</p>
    {/if}
  {/each}
</div>
