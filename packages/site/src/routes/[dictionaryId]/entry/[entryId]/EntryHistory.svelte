<script lang="ts">
  import type { History } from '@living-dictionaries/types';
  export let history: History[];
</script>

<div class={$$props.class}>
  {#each history as record}
    {#if window.location.pathname.match(record.editedLexeme)}
      <p>{record.editor} edited this entry on {record.updatedAt.toDate().toLocaleString()}</p>
    {/if}
  {/each}
</div>
