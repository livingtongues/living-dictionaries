<script lang="ts">
  import type { Tables } from '@living-dictionaries/types'
  import { page } from '$app/stores'
  import { supabase_date_to_friendly } from '$lib/helpers/time'

  export let can_edit = false
  export let entry_history: Tables<'content_updates'>[]

  $: ({ dictionary_editors } = $page.data)
</script>

<div class="{$$props.class} text-gray-500">
  <div class="font-semibold mb-2 border-b pb-1">{$page.data.t('history.history')} (work in progress)</div>
  {#if can_edit}
    {#each entry_history as record}
      {@const editor_name = $dictionary_editors.find(({ user_id }) => user_id === record.user_id)?.full_name}
      <div class="mb-2" title={record.change.data ? JSON.stringify(record.change.data, null, 2) : ''}>
        {supabase_date_to_friendly(record.timestamp, $page.data.locale)},
        {#if editor_name}
          <b>{editor_name}</b>,
        {/if}
        {record.change.type}
      </div>
    {/each}
  {:else if entry_history?.length}
    <p class="m-3">{$page.data.t('history.edited')} {supabase_date_to_friendly(entry_history[0].timestamp, $page.data.locale)}</p>
  {/if}
</div>
