<script lang="ts">
  import AgentCall from '../agent-call.svelte'
  import SchemaView from '../schema-view.svelte'

  let { data } = $props()

  let filter = $state('')
  const shown = $derived(data.schemas.filter(([name]) => name.toLowerCase().includes(filter.toLowerCase())))
</script>

<svelte:head><title>Schemas · Agent API</title></svelte:head>

<AgentCall path="/api/v1/openapi.json?view=full" note="The only view carrying every schema — a ?tag= slice deliberately prunes to the ones its paths reach." />

<div class="head">
  <p class="lede">Reusable object shapes referenced across the API.</p>
  <input class="filter" type="search" bind:value={filter} placeholder="Filter {data.schemas.length} schemas…" />
</div>

{#each shown as [name, schema] (name)}
  <details id="schema-{name}" class="schema">
    <summary class="schema-summary">
      <code class="schema-name">{name}</code>
      <span class="schema-desc">{schema.description ?? ''}</span>
    </summary>
    <div class="schema-body">
      <SchemaView {schema} />
    </div>
  </details>
{/each}

{#if !shown.length}
  <p class="empty">No schema matches “{filter}”.</p>
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }
  .lede {
    font-size: 0.85rem;
    color: var(--color-secondary);
  }
  .filter {
    min-width: 14rem;
  }
  .schema {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    margin-bottom: 0.4rem;
  }
  .schema-summary {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.875rem;
    cursor: pointer;
    list-style: none;
  }
  .schema-summary::-webkit-details-marker {
    display: none;
  }
  .schema-name {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 600;
  }
  .schema-desc {
    font-size: 0.78rem;
    color: var(--color-secondary);
    margin-left: auto;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 60%;
  }
  .schema-body {
    padding: 0.75rem 0.875rem 0.875rem;
    border-top: 1px solid var(--border-color);
  }
  .empty {
    font-size: 0.85rem;
    color: var(--color-secondary);
    padding: 1rem 0;
  }
</style>
