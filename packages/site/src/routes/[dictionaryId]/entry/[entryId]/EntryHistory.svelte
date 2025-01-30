<script lang="ts">
  import { get_entry_history } from '$lib/supabase/history'
  import { page } from '$app/stores'
  import { supabase_date_to_friendly } from '$lib/helpers/time'

  export let can_edit = false
  export let entry_id: string
</script>

<div class="{$$props.class} text-gray-500">
  <strong>{$page.data.t('history.entry_history')}:</strong>
  {#await get_entry_history(entry_id)}
    Loading...
  {:then { entry_content_updates }}
    {#if can_edit}
      {#each entry_content_updates as record}
        <p class="m-3">{$page.data.t('history.entry_message')} {supabase_date_to_friendly(record.timestamp, $page.data.locale)}</p>
      {/each}
    {:else}
      <p class="m-3">{$page.data.t('history.edited')} {new Date(entry_content_updates[0].timestamp).toDateString()}</p>
    {/if}
  {:catch error}
    <p class="m-3">Error: {error.message}</p>
  {/await}
</div>
