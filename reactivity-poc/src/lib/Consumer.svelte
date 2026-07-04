<script lang="ts">
  import type { LiveDb } from './live-db.svelte'
  import LateReader from './LateReader.svelte'

  const { db, variant }: { db: LiveDb, variant: 'broken' | 'fixed' } = $props()

  // The pattern under test: bare `$derived` reads of a lazily-created store —
  // exactly `$derived(dict_db.featured_entries.rows.find(...))` from the LD
  // entry page. These deriveds are the FIRST readers, so THEY trigger store
  // creation.
  const count = $derived(db.items.rows.length)
  const star_row = $derived(db.items.rows.find(row => row.label === 'star'))
  const loading = $derived(db.items.loading)

  // Ground truth, no reactivity involved: bumped manually after every click.
  let backend_size = $state(0)
  // Late reader mounts AFTER the deriveds evaluated (so the store already
  // exists when it reads — per SvelteMap semantics it tracks fine either way).
  let show_late_reader = $state(false)
  $effect(() => {
    show_late_reader = true
  })

  function probe() {
    // Untracked pulls of the same deriveds — if these differ from the DOM,
    // the derived recomputes on demand and only the template edge is dead;
    // if they match the stale DOM, the derived itself has no dependencies.
    console.log('[probe]', JSON.stringify({ loading, count, star: star_row?.id ?? null }))
  }

  function insert(label: string) {
    db.backend.insert(label)
    backend_size = db.backend.size
  }
  function remove_last() {
    db.backend.remove_last()
    backend_size = db.backend.size
  }

  const stale = $derived(!loading && count !== backend_size)
</script>

<section>
  <p>
    Click the buttons, then compare the bare-<code>$derived</code> readouts
    against the backend truth and the late-reader list below.
    {#if variant === 'broken'}
      Store creation happens <strong>inside</strong> the first consuming reaction
      (the current pattern) — expect the deriveds to go stale.
    {:else}
      Store creation is hoisted <strong>outside</strong> the reaction via
      <code>$effect.root</code> — expect everything to stay live.
    {/if}
  </p>

  <div class="buttons">
    <button onclick={() => insert(`row ${db.backend.size + 1}`)}>insert row</button>
    <button onclick={() => insert('star')}>insert ⭐ row</button>
    <button onclick={remove_last}>remove last</button>
    <button onclick={probe}>probe (console)</button>
  </div>

  <table>
    <tbody>
      <tr>
        <th>backend row count (truth)</th>
        <td>{backend_size}</td>
      </tr>
      <!-- FIRST reader in DOM order → this derived triggers store creation,
           mirroring the entry page's star_row derived exactly. -->
      <tr>
        <th><code>$derived(rows.find(r =&gt; r.label === 'star'))</code> <em>(creator)</em></th>
        <td data-testid="derived-star">{star_row ? `⭐ found (id ${star_row.id})` : 'not found'}</td>
      </tr>
      <tr class:stale>
        <th><code>$derived(db.items.rows.length)</code></th>
        <td data-testid="derived-count">{count}</td>
      </tr>
      <tr>
        <th><code>$derived(db.items.loading)</code></th>
        <td data-testid="derived-loading">{loading}</td>
      </tr>
    </tbody>
  </table>

  {#if stale}
    <p class="verdict bad" data-testid="verdict">✗ STALE — the deriveds lost their dependency edge</p>
  {:else if !loading}
    <p class="verdict good" data-testid="verdict">✓ in sync</p>
  {/if}

  {#if show_late_reader}
    <LateReader {db} />
  {/if}
</section>

<style>
  section {
    max-width: 40rem;
  }
  .buttons {
    display: flex;
    gap: 0.5rem;
    margin: 1rem 0;
  }
  button {
    font-size: 1rem;
    padding: 0.4rem 0.8rem;
  }
  table {
    border-collapse: collapse;
  }
  th, td {
    text-align: left;
    padding: 0.3rem 0.8rem;
    border: 1px solid #ccc;
  }
  .stale td {
    background: #fdd;
  }
  .verdict {
    font-weight: bold;
  }
  .bad {
    color: #b00;
  }
  .good {
    color: #080;
  }
</style>
