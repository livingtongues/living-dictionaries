<script lang="ts">
  import type { HistoryChange, HistoryUser } from './types'
  import { day_key, field_label, format_at, format_value, summarize_snapshot, table_label, user_display } from './format'

  interface Props {
    changes: HistoryChange[]
    users: Record<string, HistoryUser>
    loading?: boolean
    has_more?: boolean
    onloadmore?: () => void
    empty_label?: string
  }

  const { changes, users, loading = false, has_more = false, onloadmore, empty_label = 'No changes recorded yet.' }: Props = $props()

  const OP_META = {
    insert: { label: 'added', class: 'op-insert' },
    update: { label: 'edited', class: 'op-update' },
    delete: { label: 'removed', class: 'op-delete' },
  } as const

  // Group consecutive changes by calendar day for a scannable timeline.
  const groups = $derived.by(() => {
    const out: { day: string, items: HistoryChange[] }[] = []
    for (const change of changes) {
      const day = day_key(change.at)
      const last = out[out.length - 1]
      if (last && last.day === day)
        last.items.push(change)
      else
        out.push({ day, items: [change] })
    }
    return out
  })

  function delta_rows(change: HistoryChange) {
    if (!change.delta)
      return []
    return Object.entries(change.delta).map(([field, { old, new: next }]) => ({
      field: field_label(field),
      old: format_value(old),
      next: format_value(next),
    }))
  }
</script>

<div class="timeline">
  {#if !changes.length && !loading}
    <p class="empty">{empty_label}</p>
  {/if}

  {#each groups as group (group.day)}
    <div class="day">{group.day}</div>
    {#each group.items as change (change.id)}
      {@const op = OP_META[change.op]}
      <div class="change">
        <div class="meta">
          <span class="badge {op.class}">{op.label}</span>
          <span class="kind">{table_label(change.table_name)}</span>
          <span class="who">{user_display(users[change.user_id], change.user_id)}</span>
          <span class="when" title={change.at}>{format_at(change.at)}</span>
        </div>

        {#if change.op === 'update'}
          <ul class="fields">
            {#each delta_rows(change) as row (row.field)}
              <li>
                <span class="field">{row.field}</span>
                <span class="old">{row.old}</span>
                <span class="arrow">→</span>
                <span class="new">{row.next}</span>
              </li>
            {/each}
          </ul>
        {:else}
          <ul class="fields summary">
            {#each summarize_snapshot(change.snapshot) as row (row.field)}
              <li>
                <span class="field">{row.field}</span>
                <span class="new">{row.value}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/each}
  {/each}

  {#if loading}
    <p class="loading">Loading…</p>
  {/if}

  {#if has_more && !loading}
    <button type="button" class="load-more" onclick={() => onloadmore?.()}>Load older changes</button>
  {/if}
</div>

<style>
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 14px;
  }
  .empty,
  .loading {
    color: var(--color-grey-600, #6b7280);
    font-style: italic;
    padding: 12px 4px;
  }
  .day {
    position: sticky;
    top: 0;
    background: var(--surface, #fff);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-grey-500, #9ca3af);
    padding: 12px 0 4px;
  }
  .change {
    padding: 8px 0;
    border-top: 1px solid rgba(127, 127, 127, 0.14);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .badge {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 1px 7px;
    border-radius: 999px;
    color: #fff;
  }
  .op-insert { background: #16a34a; }
  .op-update { background: #2563eb; }
  .op-delete { background: #dc2626; }
  .kind {
    font-weight: 600;
  }
  .who {
    color: var(--color-grey-700, #374151);
  }
  .when {
    margin-left: auto;
    color: var(--color-grey-500, #9ca3af);
    font-size: 12px;
    white-space: nowrap;
  }
  .fields {
    list-style: none;
    margin: 6px 0 0;
    padding: 0 0 0 2px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .fields li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
    line-height: 1.4;
  }
  .field {
    font-weight: 600;
    color: var(--color-grey-700, #374151);
    min-width: 96px;
  }
  .old {
    color: var(--color-grey-500, #9ca3af);
    text-decoration: line-through;
  }
  .arrow {
    color: var(--color-grey-400, #9ca3af);
  }
  .new {
    color: var(--color-grey-900, #111827);
  }
  .summary .new {
    color: var(--color-grey-700, #374151);
  }
  .load-more {
    align-self: flex-start;
    margin-top: 10px;
    padding: 6px 14px;
    border: 1px solid rgba(127, 127, 127, 0.3);
    border-radius: 8px;
    background: transparent;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    color: inherit;
  }
  .load-more:hover {
    background: rgba(127, 127, 127, 0.08);
  }
</style>
