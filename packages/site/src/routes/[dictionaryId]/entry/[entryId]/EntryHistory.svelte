<script lang="ts">
  import type { Change } from '@living-dictionaries/types';

  export let history: Change[];
  export let canEdit = false;

  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
</script>

<div class="{$$props.class} text-gray-500">
  {#if canEdit}
    <!-- TODO translate -->
    <strong>Lexeme history:</strong>
    {#each history as record}
      <p class="m-3">{record.updatedName} edited this entry on {formatter.format(new Date(record.updatedAtMs))}</p>
    {/each}
  {:else}
    <p class="m-3">Last edited on {new Date(history[0].updatedAtMs).toDateString()}</p>
  {/if}
</div>
