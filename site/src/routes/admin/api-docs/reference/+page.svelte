<script lang="ts">
  import AgentCall from '../agent-call.svelte'
  import { method_color, METHOD_ORDER } from '../helpers'

  let { data } = $props()

  interface Row { path: string, methods: string[], summary: string }
  interface Group { name: string, description: string, rows: Row[] }

  /** Regroup the compact index by tag, collapsing a path's methods onto one row. */
  const groups = $derived.by<Group[]>(() => {
    const by_tag: Record<string, Row[]> = {}
    for (const [path, operations] of Object.entries(data.index.paths ?? {})) {
      for (const method of METHOD_ORDER) {
        const operation = operations[method]
        if (!operation)
          continue
        const tag = operation.tags?.[0] ?? 'other'
        const rows = by_tag[tag] ?? []
        const existing = rows.find(row => row.path === path)
        if (existing)
          existing.methods.push(method)
        else
          rows.push({ path, methods: [method], summary: operation.summary ?? '' })
        by_tag[tag] = rows
      }
    }
    return (data.index.tags ?? [])
      .filter(tag => by_tag[tag.name])
      .map(tag => ({ name: tag.name, description: tag.description ?? '', rows: by_tag[tag.name] ?? [] }))
  })
</script>

<AgentCall path="/api/v1/openapi.json" note="The DEFAULT view is this compact index — paths, summaries, and schema names only. The full ~200KB document needs ?view=full." />

<p class="lede">
  {data.index.schema_names?.length ?? 0} schemas across {groups.length} groups. Open a group to see
  its operations with full request/response schemas — that's the <code>?tag=</code> slice an agent
  fetches once it knows what it needs.
</p>

<div class="groups">
  {#each groups as group (group.name)}
    <section class="group">
      <a class="group-head" href="/admin/api-docs/reference/{group.name}">
        <h2 class="group-name">{group.name}</h2>
        <span class="count">{group.rows.length} path{group.rows.length === 1 ? '' : 's'}</span>
      </a>
      {#if group.description}<p class="group-desc">{group.description}</p>{/if}
      <ul class="rows">
        {#each group.rows as row (row.path)}
          <li class="row">
            <span class="methods">
              {#each row.methods as method (method)}
                <code class="method" style="--method: {method_color(method)}">{method}</code>
              {/each}
            </span>
            <code class="path">{row.path}</code>
            <span class="summary">{row.summary}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .lede {
    font-size: 0.88rem;
    color: var(--color-secondary);
    margin-bottom: 1rem;
  }
  .lede code {
    font-family: var(--font-mono);
  }
  .groups {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 2rem;
  }
  .group {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.6rem;
    padding: 0.7rem 0.9rem;
  }
  .group-head {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    text-decoration: none;
    color: inherit;
  }
  .group-name {
    font-size: 1rem;
    font-weight: 600;
    text-transform: capitalize;
    color: var(--primary);
  }
  .count {
    font-size: 0.72rem;
    color: var(--color-secondary);
    background: var(--background);
    border-radius: 999px;
    padding: 0 0.4rem;
  }
  .group-desc {
    font-size: 0.8rem;
    color: var(--color-secondary);
    margin: 0.25rem 0 0.5rem;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .row {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.4rem;
    font-size: 0.8rem;
  }
  .methods {
    display: inline-flex;
    gap: 0.2rem;
    flex-shrink: 0;
  }
  .method {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--method);
    border: 1px solid var(--method);
    border-radius: 0.25rem;
    padding: 0 0.3rem;
  }
  .path {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    word-break: break-all;
  }
  .summary {
    color: var(--color-secondary);
    font-size: 0.78rem;
  }
</style>
