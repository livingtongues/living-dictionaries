<script lang="ts">
  /**
   * Renders a SQLite table as a compact card. Positioned + made interactive by
   * the parent `schema-graph.svelte` canvas (we no longer depend on xyflow).
   */
  import type { TableInfo } from '$lib/db/introspect'
  import IconMdiFingerprint from '~icons/mdi/fingerprint'
  import IconMdiKey from '~icons/mdi/key'
  import IconMdiLinkVariant from '~icons/mdi/link-variant'
  import IconMdiTable from '~icons/mdi/table'
  import type { TableKind } from './build-graph.js'

  interface Props {
    table: TableInfo
    kind: TableKind
    selected?: boolean
  }
  const { table, kind, selected = false }: Props = $props()
</script>

<div class="table-node" class:selected data-node-name={table.name}>
  <header class="node-header">
    <IconMdiTable style="color: var(--primary); font-size: 0.875rem; flex-shrink: 0" />
    <span class="node-name" title={table.name}>{table.name}</span>
    {#if kind === 'junction'}
      <span class="kind-tag" title="id-PK + ≥2 FKs (sync-friendly join shape)">junction</span>
    {:else if kind === 'derived'}
      <span class="kind-tag primary" title="Composite-PK projection — not synced; rebuilt locally by triggers">derived</span>
    {/if}
    {#if table.row_count !== null}
      <span class="row-count">{table.row_count}</span>
    {/if}
  </header>

  <ul class="column-list">
    {#each table.columns as col (col.name)}
      <li class="column-row">
        <span class="gutter">
          {#if col.pk_order > 0}
            <span title="primary key"><IconMdiKey style="font-size: 11px" /></span>
          {/if}
          {#if col.is_foreign_key}
            <span title="foreign key"><IconMdiLinkVariant style="font-size: 11px" /></span>
          {/if}
          {#if col.is_unique && col.pk_order === 0}
            <span title="unique"><IconMdiFingerprint style="font-size: 11px" /></span>
          {/if}
        </span>
        <span class="col-name" title={col.name}>{col.name}</span>
        <span class="col-type">{col.type || '—'}</span>
      </li>
    {/each}
  </ul>
</div>

<style>
  .table-node {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  }
  .table-node.selected {
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary);
  }
  .node-header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
    background: color-mix(in srgb, var(--primary), transparent 92%);
    border-bottom: 1px solid var(--border-color);
  }
  .node-name {
    font-weight: 600;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kind-tag {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    padding: 1px 0.25rem;
    border-radius: 0.25rem;
    background: var(--background);
    color: var(--color-secondary);
    border: 1px solid var(--border-color);
  }
  .kind-tag.primary {
    color: var(--primary);
    border-color: var(--primary);
  }
  .row-count {
    font-size: 10px;
    color: var(--color-secondary);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }
  .column-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 400px;
    overflow: hidden;
  }
  .column-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    line-height: 1.25;
    border-bottom: 1px solid var(--border-color);
  }
  .column-row:last-child {
    border-bottom: none;
  }
  .gutter {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    width: 2.25rem;
    flex-shrink: 0;
    color: var(--color-secondary);
  }
  .col-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  .col-type {
    color: var(--color-secondary);
    font-size: 10px;
    text-transform: uppercase;
    flex-shrink: 0;
  }
</style>
