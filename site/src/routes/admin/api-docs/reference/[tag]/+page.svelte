<script lang="ts">
  import AgentCall from '../../agent-call.svelte'
  import { build_tag_groups } from '../../helpers'
  import OperationView from '../../operation-view.svelte'
  import SchemaView from '../../schema-view.svelte'

  let { data } = $props()

  const operations = $derived(build_tag_groups(data.spec)[0]?.operations ?? [])
  const schemas = $derived(Object.entries(data.spec.components?.schemas ?? {}) as [string, any][])
  const kb = $derived(Math.round(data.bytes / 102.4) / 10)
</script>

<svelte:head><title>{data.tag.name} · Agent API</title></svelte:head>

<AgentCall path="/api/v1/openapi.json?tag={data.tag.name}" note="{kb} KB — this group's operations plus only the schemas they reach." />

<h2 class="tag-name">{data.tag.name}</h2>
{#if data.tag.description}<p class="tag-desc">{data.tag.description}</p>{/if}

{#each operations as operation (operation.method + operation.path)}
  <OperationView {operation} />
{/each}

<h3 class="schemas-title">Schemas reachable from this group <span class="count">{schemas.length}</span></h3>
{#each schemas as [name, schema] (name)}
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

<a class="back" href="/admin/api-docs/reference">← All groups</a>

<style>
  .tag-name {
    font-size: 1.2rem;
    font-weight: 600;
    text-transform: capitalize;
  }
  .tag-desc {
    font-size: 0.85rem;
    color: var(--color-secondary);
    margin: 0.25rem 0 0.9rem;
  }
  .schemas-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 1.75rem 0 0.6rem;
    padding-bottom: 0.35rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }
  .count {
    font-size: 0.72rem;
    font-weight: 400;
    color: var(--color-secondary);
    background: var(--surface);
    border-radius: 999px;
    padding: 0 0.4rem;
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
  .back {
    display: inline-block;
    margin: 1.25rem 0 2rem;
    font-size: 0.85rem;
    text-decoration: none;
  }
</style>
