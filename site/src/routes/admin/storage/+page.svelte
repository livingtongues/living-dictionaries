<script lang="ts">
  import type { AdminStorageResponseBody, StorageDictRow } from '../../api/admin/storage/+server'
  import { api_admin_storage } from '$api/admin/storage/_call'
  import LineChart from '$lib/charts/LineChart.svelte'
  import SegmentedBar from '$lib/charts/SegmentedBar.svelte'
  import { format_relative_time } from '$lib/utils/format-relative-time'
  import { onMount } from 'svelte'

  let data_state = $state<AdminStorageResponseBody | null>(null)
  let load_error = $state('')

  onMount(async () => {
    const { data, error } = await api_admin_storage()
    if (error) {
      load_error = error.message
      return
    }
    data_state = data
  })

  const TYPE_COLORS: Record<string, string> = {
    audio: 'var(--primary)',
    video: '#8b5cf6',
    photo: '#0ea5e9',
  }
  const TYPES = ['audio', 'video', 'photo'] as const

  function format_bytes(bytes: number): string {
    if (bytes >= 1e9)
      return `${(bytes / 1e9).toFixed(bytes >= 1e10 ? 0 : 1)} GB`
    if (bytes >= 1e6)
      return `${(bytes / 1e6).toFixed(bytes >= 1e7 ? 0 : 1)} MB`
    if (bytes >= 1e3)
      return `${(bytes / 1e3).toFixed(0)} KB`
    return `${bytes} B`
  }

  const total_bytes = $derived((data_state?.totals ?? []).reduce((sum, row) => sum + row.bytes, 0))
  const total_objects = $derived((data_state?.totals ?? []).reduce((sum, row) => sum + row.object_count, 0))

  const type_segments = $derived((data_state?.totals ?? []).map(row => ({
    label: row.media_type,
    value: row.bytes,
    color: TYPE_COLORS[row.media_type] ?? 'var(--text-3)',
  })))

  // ── by category (= current dictionaries.bucket) ────────────────────────────
  interface CategoryAggregate {
    bucket: string
    total_bytes: number
    dict_count: number
    by_type: Record<string, number>
  }
  const categories = $derived.by<CategoryAggregate[]>(() => {
    const by_bucket: Record<string, CategoryAggregate> = {}
    for (const dict of data_state?.dicts ?? []) {
      const bucket = dict.bucket ?? 'unclassified'
      by_bucket[bucket] ??= { bucket, total_bytes: 0, dict_count: 0, by_type: { audio: 0, video: 0, photo: 0 } }
      const aggregate = by_bucket[bucket]
      aggregate.total_bytes += dict.total_bytes
      aggregate.dict_count += 1
      aggregate.by_type.audio += dict.audio_bytes
      aggregate.by_type.video += dict.video_bytes
      aggregate.by_type.photo += dict.photo_bytes
    }
    return Object.values(by_bucket).sort((a, b) => b.total_bytes - a.total_bytes)
  })

  // ── trend (site-wide; per-type toggle) ─────────────────────────────────────
  let trend_type = $state<'total' | 'audio' | 'video' | 'photo'>('total')
  const trend_series = $derived.by(() => {
    const by_date: Record<string, number> = {}
    for (const point of data_state?.trend ?? []) {
      if (trend_type !== 'total' && point.media_type !== trend_type)
        continue
      by_date[point.date] = (by_date[point.date] ?? 0) + point.bytes
    }
    return Object.entries(by_date).map(([date, value]) => ({ date, value }))
  })

  // ── dict table ─────────────────────────────────────────────────────────────
  let sort_by = $state<keyof StorageDictRow>('total_bytes')
  let filter = $state('')
  let show_all = $state(false)
  const sorted_dicts = $derived.by(() => {
    const query = filter.trim().toLowerCase()
    const rows = (data_state?.dicts ?? []).filter(dict => !query
      || dict.dict_id.toLowerCase().includes(query)
      || (dict.name ?? '').toLowerCase().includes(query)
      || (dict.bucket ?? 'unclassified').toLowerCase().includes(query))
    return [...rows].sort((a, b) => {
      const left = a[sort_by]
      const right = b[sort_by]
      if (typeof left === 'number' && typeof right === 'number')
        return right - left
      return String(left ?? '').localeCompare(String(right ?? ''))
    })
  })
  const visible_dicts = $derived(show_all ? sorted_dicts : sorted_dicts.slice(0, 50))

  function sort_button(column: keyof StorageDictRow, label: string): { column: keyof StorageDictRow, label: string } {
    return { column, label }
  }
  const columns = [
    sort_button('dict_id', 'Dictionary'),
    sort_button('bucket', 'Category'),
    sort_button('audio_bytes', 'Audio'),
    sort_button('video_bytes', 'Video'),
    sort_button('photo_bytes', 'Photo'),
    sort_button('total_bytes', 'Total'),
    sort_button('object_count', 'Objects'),
  ]
</script>

<svelte:head><title>Storage · Admin</title></svelte:head>

<div class="page">
  <header class="page-header">
    <h1>Media storage</h1>
    {#if data_state}
      <div class="meta">
        Ledger of the R2 media bucket · last reconciled {data_state.last_reconcile ? format_relative_time(data_state.last_reconcile) : 'never'}
        {#if data_state.orphaned.object_count}
          · {data_state.orphaned.object_count} orphaned objects ({format_bytes(data_state.orphaned.bytes)}) awaiting the 30-day grace
        {/if}
      </div>
    {/if}
  </header>

  {#if load_error}
    <div class="error">{load_error}</div>
  {:else if !data_state}
    <div class="loading">Loading…</div>
  {:else}
    <section class="cards">
      <div class="card total">
        <div class="card-value">{format_bytes(total_bytes)}</div>
        <div class="card-label">{total_objects.toLocaleString()} objects</div>
      </div>
      {#each data_state.totals as row (row.media_type)}
        <div class="card">
          <div class="card-value" style:color={TYPE_COLORS[row.media_type]}>{format_bytes(row.bytes)}</div>
          <div class="card-label">{row.media_type} · {row.object_count.toLocaleString()}</div>
        </div>
      {/each}
    </section>

    <SegmentedBar segments={type_segments} format={format_bytes} />

    <section>
      <h2>By category</h2>
      <div class="categories">
        {#each categories as category (category.bucket)}
          <div class="category">
            <div class="category-head">
              <span class="category-name">{category.bucket}</span>
              <span class="category-meta">{format_bytes(category.total_bytes)} · {category.dict_count} dicts</span>
            </div>
            <SegmentedBar
              height={22}
              segments={TYPES.filter(type => category.by_type[type] > 0).map(type => ({ label: type, value: category.by_type[type], color: TYPE_COLORS[type] }))}
              format={format_bytes} />
          </div>
        {/each}
      </div>
    </section>

    <section>
      <div class="trend-head">
        <h2>Growth over time</h2>
        <div class="chips">
          {#each ['total', ...TYPES] as option (option)}
            <button type="button" class={['chip', { active: trend_type === option }]} onclick={() => trend_type = option as typeof trend_type}>{option}</button>
          {/each}
        </div>
      </div>
      {#if trend_series.length > 1}
        <LineChart
          series={trend_series}
          area
          color={trend_type === 'total' ? 'var(--primary)' : TYPE_COLORS[trend_type]}
          y_format={format_bytes}
          tip_format={format_bytes} />
      {:else}
        <div class="loading">Trend appears once daily rollups accumulate.</div>
      {/if}
    </section>

    <section>
      <h2>By dictionary</h2>
      <input class="filter" type="search" placeholder="Filter by name, id, or category…" bind:value={filter} />
      <table>
        <thead>
          <tr>
            {#each columns as { column, label } (column)}
              <th class={{ active: sort_by === column, numeric: label !== 'Dictionary' && label !== 'Category' }}>
                <button type="button" onclick={() => sort_by = column}>{label}</button>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each visible_dicts as dict (dict.dict_id)}
            <tr>
              <td><a href="/{dict.dict_id}" target="_blank" rel="noreferrer">{dict.name ?? dict.dict_id}</a></td>
              <td><span class="bucket {dict.bucket ?? 'unclassified'}">{dict.bucket ?? '—'}</span></td>
              <td class="numeric">{dict.audio_bytes ? format_bytes(dict.audio_bytes) : '—'}</td>
              <td class="numeric">{dict.video_bytes ? format_bytes(dict.video_bytes) : '—'}</td>
              <td class="numeric">{dict.photo_bytes ? format_bytes(dict.photo_bytes) : '—'}</td>
              <td class="numeric total-col">{format_bytes(dict.total_bytes)}</td>
              <td class="numeric">{dict.object_count.toLocaleString()}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if !show_all && sorted_dicts.length > 50}
        <button type="button" class="btn-outline show-all" onclick={() => show_all = true}>
          Show all {sorted_dicts.length} dictionaries
        </button>
      {/if}
    </section>
  {/if}
</div>

<style>
  .page {
    max-width: 1000px;
    margin: 0 auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  h1 {
    font-size: 1.375rem;
    font-weight: 700;
  }

  h2 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.625rem;
  }

  .meta {
    font-size: 0.8125rem;
    color: var(--text-2);
    margin-top: 0.25rem;
  }

  .error {
    color: var(--danger);
  }

  .loading {
    color: var(--text-2);
    font-size: 0.875rem;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.875rem 1rem;
  }

  .card.total {
    border-color: var(--primary);
  }

  .card-value {
    font-size: 1.375rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .card-label {
    font-size: 0.75rem;
    color: var(--text-2);
    margin-top: 0.125rem;
    text-transform: capitalize;
  }

  .categories {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .category-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.25rem;
  }

  .category-name {
    font-weight: 600;
    font-size: 0.875rem;
    text-transform: capitalize;
  }

  .category-meta {
    font-size: 0.8125rem;
    color: var(--text-2);
  }

  .trend-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .chips {
    display: flex;
    gap: 0.375rem;
  }

  .chip {
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-2);
    border-radius: 9999px;
    padding: 0.2rem 0.7rem;
    font-size: 0.75rem;
    cursor: pointer;
    text-transform: capitalize;
  }

  .chip.active {
    border-color: var(--primary);
    color: var(--primary);
    font-weight: 600;
  }

  .filter {
    width: 100%;
    margin-bottom: 0.625rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }

  th {
    text-align: left;
    border-bottom: 2px solid var(--border);
    padding: 0.375rem 0.5rem;
    white-space: nowrap;
  }

  th button {
    background: none;
    border: none;
    font: inherit;
    font-weight: 600;
    color: var(--text-2);
    cursor: pointer;
    padding: 0;
  }

  th.active button {
    color: var(--primary);
  }

  th.numeric,
  td.numeric {
    text-align: right;
  }

  td {
    border-bottom: 1px solid var(--border);
    padding: 0.375rem 0.5rem;
    font-variant-numeric: tabular-nums;
  }

  td a {
    color: inherit;
    text-decoration: none;
    font-weight: 500;
  }

  td a:hover {
    text-decoration: underline;
  }

  .total-col {
    font-weight: 600;
  }

  .bucket {
    font-size: 0.6875rem;
    text-transform: capitalize;
    color: var(--text-2);
  }

  .bucket.public { color: var(--success); }
  .bucket.delete { color: var(--danger); }
  .bucket.secure { color: var(--primary); }

  .show-all {
    margin-top: 0.625rem;
  }
</style>
