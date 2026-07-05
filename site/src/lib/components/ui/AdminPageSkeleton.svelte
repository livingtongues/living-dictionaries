<script lang="ts">
  // Generic loading skeleton for admin pages streamed via {#await}. Mirrors the
  // common admin shape (title + optional toolbar, then cards / panels / list
  // rows) closely enough to avoid a jarring layout shift. Data-viz pages with a
  // distinctive layout ship their own bespoke skeleton instead.
  import Skeleton from '$lib/components/ui/Skeleton.svelte'

  interface Props {
    /** cards = stat tiles; panels = big chart/section blocks; list = table rows. */
    variant?: 'cards' | 'panels' | 'list'
    title_width?: string
    toolbar?: boolean
    cards?: number
    panels?: number
    rows?: number
  }
  let {
    variant = 'panels',
    title_width = '10rem',
    toolbar = true,
    cards = 0,
    panels = 2,
    rows = 8,
  }: Props = $props()
</script>

<div class="admin-skel" aria-busy="true" aria-label="Loading">
  <header class="head">
    <Skeleton width={title_width} height="1.5rem" />
    {#if toolbar}
      <div class="toolbar"><Skeleton width="12rem" height="1.9rem" radius="0.5rem" /></div>
    {/if}
  </header>

  {#if cards > 0}
    <section class="cards" style:grid-template-columns={`repeat(${Math.min(cards, 4)}, 1fr)`}>
      {#each Array.from({ length: cards }) as _, i (i)}
        <div class="card">
          <Skeleton width="4rem" height="1.6rem" />
          <Skeleton width="6.5rem" height="0.7rem" />
        </div>
      {/each}
    </section>
  {/if}

  {#if variant === 'panels'}
    {#each Array.from({ length: panels }) as _, i (i)}
      <section class="panel">
        <Skeleton width="12rem" height="0.95rem" />
        <div class="panel-body"><Skeleton width="100%" height="100%" radius="0.5rem" /></div>
      </section>
    {/each}
  {:else if variant === 'list'}
    <section class="panel list">
      {#each Array.from({ length: rows }) as _, i (i)}
        <div class="row">
          <Skeleton width="1.6rem" height="1.6rem" radius="0.4rem" />
          <div class="row-lines">
            <Skeleton width={`${55 + ((i * 7) % 35)}%`} height="0.85rem" />
            <Skeleton width={`${25 + ((i * 5) % 25)}%`} height="0.65rem" />
          </div>
          <Skeleton width="3rem" height="0.85rem" />
        </div>
      {/each}
    </section>
  {/if}
</div>

<style>
  .admin-skel {
    max-width: 70rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .toolbar {
    margin-left: auto;
  }
  .cards {
    display: grid;
    gap: 0.75rem;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.625rem;
    padding: 0.875rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .panel {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.625rem;
    padding: 1rem 1.125rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .panel-body {
    height: 180px;
  }
  .list {
    gap: 1.1rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .row-lines {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  @media (max-width: 48rem) {
    .cards { grid-template-columns: repeat(2, 1fr) !important; }
  }
</style>
