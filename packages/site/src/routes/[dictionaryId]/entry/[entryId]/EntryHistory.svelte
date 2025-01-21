<script lang="ts">
  import { get_entry_history } from '$lib/supabase/history'

  export let can_edit = false
  export let entry_id: string

  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
</script>

<div class="{$$props.class} text-gray-500">
  {#if can_edit}
    <!-- TODO translate -->
    <strong>Lexeme history:</strong>
    {#await get_entry_history(entry_id)}
      Loading...
    {:then { entry_content_updates, error }}
      <!-- <pre>{JSON.stringify(entry_content_updates, null, 2)}</pre>
      <pre>{JSON.stringify(error, null, 2)}</pre> -->
      {#each entry_content_updates as record}
        <p class="m-3">{record.user_id} edited this entry on {formatter.format(new Date(record.timestamp))}</p>
      {/each}
    {/await}
  {:else}
    <p class="m-3">Last edited on {new Date(history[0].updatedAtMs).toDateString()}</p>
  {/if}
</div>
