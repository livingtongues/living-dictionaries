<script lang="ts">
  import type { SchemaInfo } from '$lib/db/introspect'
  import IconMdiEye from '~icons/mdi/eye'
  import IconMdiFlash from '~icons/mdi/flash'
  import TableCard from './table-card.svelte'

  let { schema }: { schema: SchemaInfo } = $props()
</script>

{#if schema.tables.length > 0}
  <nav class="anchor-nav">
    {#each schema.tables as table (table.name)}
      <a href="#table-{table.name}" class="anchor-pill">{table.name}</a>
    {/each}
  </nav>
{/if}

<div class="table-stack">
  {#each schema.tables as table (table.name)}
    <TableCard {table} />
  {/each}
</div>

{#if schema.views.length > 0}
  <h2 class="section-heading">Views</h2>
  <div class="card-stack">
    {#each schema.views as view (view.name)}
      <section id="view-{view.name}" class="schema-card">
        <header class="schema-card-header">
          <IconMdiEye style="font-size: 1.125rem; color: var(--primary)" />
          <h3 class="schema-card-title">{view.name}</h3>
        </header>
        <pre class="schema-card-pre">{view.raw_sql}</pre>
      </section>
    {/each}
  </div>
{/if}

{#if schema.triggers.length > 0}
  <h2 class="section-heading">Triggers</h2>
  <div class="card-stack">
    {#each schema.triggers as trigger (trigger.name)}
      <section id="trigger-{trigger.name}" class="schema-card">
        <header class="schema-card-header">
          <IconMdiFlash style="font-size: 1.125rem; color: var(--primary)" />
          <h3 class="schema-card-title">{trigger.name}</h3>
          {#if trigger.table_name}
            <a href="#table-{trigger.table_name}" class="trigger-table-link">on {trigger.table_name}</a>
          {/if}
        </header>
        <pre class="schema-card-pre">{trigger.raw_sql}</pre>
      </section>
    {/each}
  </div>
{/if}

<style>
  .anchor-nav {
    margin-bottom: 1.25rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    font-size: 0.75rem;
  }
  .anchor-pill {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    background: var(--surface);
    color: var(--color-secondary);
    text-decoration: none;
    font-family: var(--font-mono);
  }
  .anchor-pill:hover {
    color: var(--primary);
  }
  .table-stack {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .section-heading {
    font-size: 1.125rem;
    font-weight: 600;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
  }
  .card-stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .schema-card {
    background: var(--surface);
    border-radius: 0.5rem;
    overflow: hidden;
    scroll-margin-top: 5rem;
  }
  .schema-card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
  }
  .schema-card-title {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 1rem;
    margin: 0;
  }
  .schema-card-pre {
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    overflow: auto;
    font-family: var(--font-mono);
    white-space: pre-wrap;
    word-break: break-all;
  }
  .trigger-table-link {
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--color-secondary);
    text-decoration: none;
    font-family: var(--font-mono);
  }
  .trigger-table-link:hover {
    color: var(--primary);
  }
</style>
