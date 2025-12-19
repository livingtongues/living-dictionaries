<script lang="ts">
  import type { Tables } from '@living-dictionaries/types'
  import { page } from '$app/stores'
  import { supabase_date_to_friendly } from '$lib/helpers/time'

  let { can_edit = false, entry_history, class: class_prop = '' }: {
    can_edit?: boolean
    entry_history: Tables<'content_updates'>[]
    class?: string
  } = $props()

  let { dictionary_editors } = $derived($page.data)
</script>

<div class="{class_prop} text-gray-500">
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
