<script lang="ts">
  import type { Tables } from '@living-dictionaries/types'
  import { onMount } from 'svelte'
  import { Button } from 'svelte-pieces'
  import { supabase_date_to_friendly } from '$lib/helpers/time'
  import { page } from '$app/stores'

  export let data

  let keys: Tables<'api_keys'>[]

  onMount(async () => {
    keys = await data.get_keys()
  })

  function generate_read_curl(api_key: string) {
    return `curl -X POST '${$page.url.origin}/api/external/read-entries' \
-H 'Content-Type: application/json' \
-d '{
  "dictionary_id": "${data.dictionary.id}",
  "api_key": "${api_key}"
}'`
  }

  function generate_write_curl(api_key: string) {
    return `curl -X POST '${$page.url.origin}/api/external/add-entry' \
-H 'Content-Type: application/json' \
-d '{
  "dictionary_id": "${data.dictionary.id}",
  "api_key": "${api_key}",
  "lexeme": "example lexeme"
}'`
  }

</script>

<h3 class="text-xl font-semibold mb-4">API Keys</h3>

<div class="mb-2">
  <Button
    onclick={async () => {
      await data.generate_key({ can_write: false })
      keys = await data.get_keys()
    }}>Create Read Key</Button>

  <Button
    onclick={async () => {
      await data.generate_key({ can_write: true })
      keys = await data.get_keys()
    }}>Create Read/Write Key</Button>
</div>

{#if keys?.length}
  <div class="pb-2 mb-2">
    Read entry data from a cache (updated once an hour) by making a POST request to:
    {$page.url.origin}/api/external/read-entries - You'll need to cache the results on your end, as the API is rate-limited. If you edit entries, you'll need to wait until the next hourly cache update to see the changes reflected in the API response.
  </div>

  {#each keys as { id, created_at, can_write, use_count, last_read_at, last_write_at }}
    <div class="mb-1 border-t pt-2">
      Key: <b>{id}</b> generated at {supabase_date_to_friendly(created_at)} with {can_write ? 'read/write' : 'read'} permission. {last_read_at ? `Last read at ${supabase_date_to_friendly(last_read_at)}` : 'Never read'}.
      {#if can_write}
        {last_write_at ? `Last write at ${supabase_date_to_friendly(last_write_at)}.` : 'Never wrote.'}
      {/if}
      {#if use_count}
        Use count: {use_count}.
      {/if}
      <Button
        size="sm"
        color="red"
        onclick={async () => {
          await data.delete_key(id)
          keys = await data.get_keys()
        }}>Delete</Button>
    </div>
    <pre class="bg-black text-white p-3 mb-2 rounded">{generate_read_curl(id)}</pre>
    {#if can_write}
      <pre class="bg-black text-white p-3 mb-2 rounded">{generate_write_curl(id)}</pre>
    {/if}
  {/each}
{:else if keys === undefined}
  <div>
    Loading keys...
  </div>
{/if}
