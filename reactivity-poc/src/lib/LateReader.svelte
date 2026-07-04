<script lang="ts">
  import type { LiveDb } from './live-db.svelte'

  // Mounted AFTER the page's deriveds already created the store, so its reads
  // never trigger creation — this list stays live even in the broken variant,
  // proving the store itself keeps working while the creator-derived is dead.
  const { db }: { db: LiveDb } = $props()
</script>

<h3>late reader (store already existed)</h3>
<ul data-testid="late-reader">
  {#each db.items.rows as row (row.id)}
    <li>{row.label}</li>
  {:else}
    <li><em>empty</em></li>
  {/each}
</ul>
