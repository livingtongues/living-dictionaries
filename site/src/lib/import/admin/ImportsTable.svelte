<script lang="ts">
  import type { AdminImportRow } from '$api/admin/imports/+server'
  import IconMdiArrowDown from '~icons/mdi/arrow-down'
  import IconMdiArrowUp from '~icons/mdi/arrow-up'
  import IconMdiBookOpenPageVariantOutline from '~icons/mdi/book-open-page-variant-outline'
  import IconMdiClipboardTextOutline from '~icons/mdi/clipboard-text-outline'
  import { IMPORT_STATUS_ORDER } from '$lib/import/import-status'
  import { format_date_time, format_relative_time } from '$lib/utils/format-relative-time'

  interface Props {
    imports: AdminImportRow[]
    on_copy_brief: (row: AdminImportRow) => void
  }
  const { imports, on_copy_brief }: Props = $props()

  type SortKey = 'dictionary' | 'requester' | 'status' | 'waiting_on' | 'materials' | 'questions' | 'assignee' | 'updated'

  const COLUMNS: { key: SortKey, label: string, numeric?: boolean }[] = [
    { key: 'dictionary', label: 'Dictionary' },
    { key: 'requester', label: 'Submitted by' },
    { key: 'status', label: 'Status' },
    { key: 'waiting_on', label: 'Waiting on' },
    { key: 'materials', label: 'Materials', numeric: true },
    { key: 'questions', label: 'Questions', numeric: true },
    { key: 'assignee', label: 'Assignee' },
    { key: 'updated', label: 'Updated' },
  ]

  const STATUS_LABELS = {
    submitted: 'Submitted',
    in_progress: 'In progress',
    waiting_on_manager: 'Waiting on them',
    resolved: 'Resolved',
  } as const

  let sort_key = $state<SortKey>('updated')
  let sort_ascending = $state(false)

  function sort_value(row: AdminImportRow, key: SortKey): string | number {
    switch (key) {
      case 'dictionary': return (row.dictionary_name ?? row.dictionary_id).toLowerCase()
      case 'requester': return (row.requester_name || row.requester_email).toLowerCase()
      case 'status': return IMPORT_STATUS_ORDER[row.status]
      case 'waiting_on': return row.waiting_on ?? 'zz'
      case 'materials': return row.resource_count * 100 + row.artifact_count
      case 'questions': return row.open_questions * 1000 + row.answered_questions
      case 'assignee': return (row.assignee_name || row.assignee_email || '').toLowerCase()
      case 'updated': return row.last_message_at
    }
  }

  function sorted(rows: AdminImportRow[]): AdminImportRow[] {
    const direction = sort_ascending ? 1 : -1
    return [...rows].sort((a, b) => {
      const left = sort_value(a, sort_key)
      const right = sort_value(b, sort_key)
      if (left === right)
        return a.last_message_at < b.last_message_at ? 1 : -1
      return left > right ? direction : -direction
    })
  }

  // Resolved imports always sink to the bottom, whatever the sort — the open ones
  // are the working list and shouldn't be interleaved with finished history.
  const open_rows = $derived(sorted(imports.filter(row => !row.resolved_at)))
  const resolved_rows = $derived(sorted(imports.filter(row => !!row.resolved_at)))

  function toggle_sort(key: SortKey) {
    if (sort_key === key) {
      sort_ascending = !sort_ascending
      return
    }
    sort_key = key
    // Names read best A→Z; everything else is most-interesting-first.
    sort_ascending = key === 'dictionary' || key === 'requester' || key === 'assignee'
  }

  function conversation_href(row: AdminImportRow): string {
    return `/${row.dictionary_url ?? row.dictionary_id}/import/${row.thread_id}`
  }
</script>

{#snippet row_cells(row: AdminImportRow)}
  <td>
    <div class="dict">
      <a class="dict-name" href={conversation_href(row)}>{row.dictionary_name ?? row.dictionary_id}</a>
      <a
        class="dict-link"
        href={`/${row.dictionary_url ?? row.dictionary_id}`}
        title="Open the dictionary itself">
        <IconMdiBookOpenPageVariantOutline />
      </a>
    </div>
  </td>

  <td>
    {#if row.requester_user_id}
      <a href={`/admin/users/${row.requester_user_id}`}>{row.requester_name || row.requester_email}</a>
    {:else}
      {row.requester_name || row.requester_email}
    {/if}
  </td>

  <td>
    <span class="pill {row.status}">{STATUS_LABELS[row.status]}</span>
    {#if row.has_activity_since_resolve}
      <span class="pill alert">new activity</span>
    {/if}
  </td>

  <td>
    {#if row.waiting_on === 'team'}
      <span class="us">Us</span>
    {:else if row.waiting_on === 'manager'}
      <span class="them">Them</span>
    {:else}
      <span class="secondary">—</span>
    {/if}
  </td>

  <td class="numeric">
    <span>{row.resource_count} file{row.resource_count === 1 ? '' : 's'}</span>
    {#if row.artifact_count}
      <span class="secondary">· {row.artifact_count} report{row.artifact_count === 1 ? '' : 's'}</span>
    {/if}
  </td>

  <td class="numeric">
    {#if row.open_questions}
      <span class="waiting">{row.answered_questions}/{row.open_questions + row.answered_questions} answered</span>
    {:else if row.answered_questions}
      <span class="answered">all {row.answered_questions} answered</span>
    {:else}
      <span class="secondary">—</span>
    {/if}
  </td>

  <td class="secondary">{row.assignee_name || row.assignee_email || '—'}</td>

  <td class="secondary nowrap" title={format_date_time(row.last_message_at)}>
    {format_relative_time(row.last_message_at)}
  </td>

  <td class="actions">
    <button type="button" class="btn-ghost" style="padding: 0.375rem" title="Copy the agent-ready job brief" onclick={() => on_copy_brief(row)}>
      <IconMdiClipboardTextOutline />
    </button>
  </td>
{/snippet}

<table>
  <thead>
    <tr>
      {#each COLUMNS as column (column.key)}
        <th
          class:numeric={column.numeric}
          aria-sort={sort_key === column.key ? (sort_ascending ? 'ascending' : 'descending') : 'none'}>
          <button type="button" onclick={() => toggle_sort(column.key)}>
            {column.label}
            {#if sort_key === column.key}
              {#if sort_ascending}<IconMdiArrowUp />{:else}<IconMdiArrowDown />{/if}
            {/if}
          </button>
        </th>
      {/each}
      <th></th>
    </tr>
  </thead>

  <tbody>
    {#each open_rows as row (row.thread_id)}
      <tr>{@render row_cells(row)}</tr>
    {/each}
  </tbody>

  {#if resolved_rows.length}
    <tbody class="resolved-group">
      <tr class="group-heading"><td colspan={COLUMNS.length + 1}>Past imports</td></tr>
      {#each resolved_rows as row (row.thread_id)}
        <tr>{@render row_cells(row)}</tr>
      {/each}
    </tbody>
  {/if}
</table>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  th {
    text-align: left;
    padding: 0;
    border-bottom: 1px solid var(--border-color);
  }
  th button {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.4rem 0.6rem;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--color-secondary);
    transition: color var(--transition-time);
  }
  th button:hover {
    color: var(--color);
  }
  th.numeric button {
    flex-direction: row-reverse;
  }
  th.numeric {
    text-align: right;
  }
  td {
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color) 7%, var(--background));
    vertical-align: middle;
  }
  tbody tr:hover td {
    background: color-mix(in srgb, var(--color) 4%, var(--background));
  }
  .resolved-group td {
    opacity: 0.7;
  }
  .group-heading td {
    border-bottom: none;
    padding-top: 1.75rem;
    padding-bottom: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--color-secondary);
  }
  .resolved-group tr.group-heading:hover td {
    background: none;
  }
  .dict {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .dict-name {
    font-weight: 600;
    font-size: 0.875rem;
  }
  .dict-link {
    color: var(--color-secondary);
    flex-shrink: 0;
  }
  a:hover {
    color: var(--primary);
    text-decoration: underline;
  }
  .numeric,
  .actions {
    text-align: right;
  }
  .nowrap,
  .numeric {
    white-space: nowrap;
  }
  .secondary {
    color: var(--color-secondary);
  }
  .pill {
    display: inline-flex;
    align-items: center;
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.1rem 0.5rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--color) 8%, var(--background));
    color: var(--color-secondary);
    white-space: nowrap;
  }
  .pill.in_progress {
    background: color-mix(in srgb, var(--warning), transparent 86%);
    color: var(--warning);
  }
  .pill.waiting_on_manager {
    background: color-mix(in srgb, var(--primary), transparent 88%);
    color: var(--primary);
  }
  .pill.resolved {
    background: color-mix(in srgb, var(--success), transparent 86%);
    color: var(--success);
  }
  .pill.alert {
    margin-left: 0.25rem;
    background: color-mix(in srgb, var(--danger), transparent 86%);
    color: var(--danger);
  }
  .us {
    font-weight: 700;
    color: var(--warning);
  }
  .them {
    font-weight: 700;
    color: var(--primary);
  }
  .waiting {
    color: var(--primary);
    font-weight: 700;
  }
  .answered {
    color: var(--success);
    font-weight: 600;
  }
  @media (max-width: 900px) {
    th:nth-child(7),
    th:nth-child(8),
    td:nth-child(7),
    td:nth-child(8) {
      display: none;
    }
  }
</style>
