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
  {#each keys as { id, created_at, can_write, use_count, last_read_at, last_write_at }}
    <div class="mb-1">
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
  {/each}

  <pre class="bg-black text-white p-3 mt-2 rounded">Read the first 1,000 entries (cached within the hour) by making a POST request to:
{$page.url.origin}/external/read-entries

With a json body:
dictionary_id: {data.dictionary.id}
api_key: [Use your generated key above]</pre>
{:else if keys === undefined}
  <div>
    Loading keys...
  </div>
{/if}
