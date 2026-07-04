<script lang="ts">
  import LateReader from '$lib/LateReader.svelte'
  import { make_live_db } from '$lib/live-db.svelte'

  const db = make_live_db({ hoist_creation: false })

  // The ONLY store reader on this page (LateReader mounts later) — so THIS
  // derived is guaranteed to be the store creator, exactly matching the LD
  // entry page's star_row derived.
  const star_row = $derived(db.items.rows.find(row => row.label === 'star'))

  let show_late_reader = $state(false)
  $effect(() => {
    show_late_reader = true
  })
</script>

<h1>broken-find — creator derived reads only <code>.rows.find()</code></h1>
<a href="/broken">→ broken</a> · <a href="/fixed">→ fixed</a>

<div class="buttons">
  <button onclick={() => db.backend.insert('star')}>insert ⭐ row</button>
  <button onclick={() => db.backend.remove_last()}>remove last</button>
  <button onclick={() => console.log('[probe]', JSON.stringify({ star: star_row?.id ?? null }))}>probe (console)</button>
</div>

<p data-testid="derived-star">{star_row ? `⭐ found (id ${star_row.id})` : 'not found'}</p>

{#if show_late_reader}
  <LateReader {db} />
{/if}

<style>
  .buttons {
    display: flex;
    gap: 0.5rem;
    margin: 1rem 0;
  }
</style>
