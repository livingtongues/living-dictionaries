<script lang="ts">
  import type { SyncLogEntry } from '$lib/db/sync/types'
  import IconMdiAlertCircle from '~icons/mdi/alert-circle'
  import IconMdiCheckCircle from '~icons/mdi/check-circle'
  import IconMdiChevronDown from '~icons/mdi/chevron-down'
  import IconMdiCloseCircle from '~icons/mdi/close-circle'
  import IconMdiCloudSync from '~icons/mdi/cloud-sync'
  import IconMdiContentCopy from '~icons/mdi/content-copy'
  import IconMdiDeleteForever from '~icons/mdi/delete-forever'
  import IconMdiDeleteOutline from '~icons/mdi/delete-outline'
  import IconMdiDownload from '~icons/mdi/download'
  import IconMdiLoading from '~icons/mdi/loading'
  import IconMdiRefresh from '~icons/mdi/refresh'
  import { delete_admin_db_and_reload, reset_sync_metadata } from '$lib/db/client/db'
  import { toast } from '$lib/state/toast.svelte.js'
  import { format_relative_time } from '$lib/utils/format-relative-time'
  import { tick } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { download_sync_report, generate_history_report_text, generate_sync_report_text } from './download-report.js'

  let { data } = $props()
  const sync = $derived(data.sync)
  const user_id = $derived(data.auth_user.user?.id)
  const log_entries = $derived<SyncLogEntry[]>(sync?.log_entries ?? [])
  const result = $derived(sync?.last_sync_result)

  let danger_busy = $state(false)

  let log_container: HTMLDivElement | undefined = $state()
  let auto_scroll = $state(true)

  $effect(() => {
    void log_entries.length
    if (auto_scroll && log_container) {
      tick().then(() => {
        if (log_container)
          log_container.scrollTop = log_container.scrollHeight
      })
    }
  })

  function handle_scroll() {
    if (!log_container)
      return
    const at_bottom = log_container.scrollHeight - log_container.scrollTop - log_container.clientHeight < 40
    auto_scroll = at_bottom
  }

  async function sync_now() {
    if (!sync || sync.is_syncing)
      return
    await sync.sync()
  }

  async function copy_report() {
    if (!sync)
      return
    const text = generate_sync_report_text({
      log_entries: sync.log_entries,
      result: sync.last_sync_result,
      user_id: user_id ?? 'unknown',
    })
    await navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  function download_report() {
    if (!sync)
      return
    download_sync_report({
      log_entries: sync.log_entries,
      result: sync.last_sync_result,
      user_id: user_id ?? 'unknown',
    })
  }

  async function reset_watermarks() {
    if (danger_busy)
      return
    if (!confirm('Clear all sync watermarks and re-pull every row from the server?\n\nLocal unsaved (dirty) writes are preserved.'))
      return
    danger_busy = true
    try {
      await reset_sync_metadata()
      if (sync)
        await sync.sync()
      toast.success('Sync watermarks reset')
    } catch (err) {
      console.error('Failed to reset watermarks:', err)
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      danger_busy = false
    }
  }

  async function delete_local_db() {
    if (danger_busy || !user_id)
      return
    if (!confirm('Delete your local admin database and reload?\n\nEverything synced from the server will be re-downloaded. Any unsaved local changes will be lost.'))
      return
    danger_busy = true
    await delete_admin_db_and_reload(user_id)
  }

  const expanded_history = new SvelteSet<number>()
  function toggle_history(index: number) {
    if (expanded_history.has(index))
      expanded_history.delete(index)
    else
      expanded_history.add(index)
  }

  function format_time(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })
  }

  function level_color(level: SyncLogEntry['level']): string | undefined {
    if (level === 'error') return 'var(--danger)'
    if (level === 'warn') return 'var(--warning)'
    if (level === 'success') return 'var(--success)'
    return undefined
  }
</script>

<h1 class="page-title">Sync dashboard</h1>

{#if !sync}
  <p class="muted">Sync engine not initialized.</p>
{:else}
  <div class="status-bar">
    <div class="status-text-wrap">
      {#if sync.is_syncing}
        <IconMdiLoading class="animate-spin" style="color: var(--primary); font-size: 1.125rem" />
        <span class="status-label">Syncing…</span>
      {:else if sync.blocked_by_client_behind}
        <IconMdiAlertCircle style="color: var(--danger); font-size: 1.125rem" />
        <span class="status-label">Client out of date — reload to update</span>
      {:else if result?.success}
        <IconMdiCheckCircle style="color: var(--success); font-size: 1.125rem" />
        <span class="status-label">Sync complete</span>
        <span class="status-meta">{(result.duration_ms / 1000).toFixed(1)}s</span>
      {:else if result && !result.success}
        <IconMdiAlertCircle style="color: var(--danger); font-size: 1.125rem" />
        <span class="status-label">Sync error</span>
        {#if sync.last_error}
          <span class="status-error-text">{sync.last_error}</span>
        {/if}
      {:else}
        <span class="status-meta">Idle</span>
      {/if}
    </div>

    <button type="button" class="btn btn-default" disabled={sync.is_syncing} onclick={sync_now}>
      {#if sync.is_syncing}
        <IconMdiLoading class="animate-spin" style="margin-right: 0.25rem" />Syncing…
      {:else}
        <IconMdiCloudSync style="margin-right: 0.25rem" />Sync now
      {/if}
    </button>

    <button type="button" class="btn-ghost icon-btn" disabled={log_entries.length === 0} onclick={copy_report} title="Copy last report">
      <IconMdiContentCopy style="font-size: 1.125rem" />
    </button>

    <button type="button" class="btn-ghost icon-btn" disabled={log_entries.length === 0} onclick={download_report} title="Download report">
      <IconMdiDownload style="font-size: 1.125rem" />
    </button>

    <button type="button" class="btn-ghost icon-btn" disabled={danger_busy || sync.is_syncing} onclick={reset_watermarks} title="Reset sync watermarks">
      <IconMdiRefresh style="font-size: 1.125rem" />
    </button>
  </div>

  {#if result}
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-value">{result.items_uploaded}</div>
        <div class="metric-label">Uploaded</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">{result.items_downloaded}</div>
        <div class="metric-label">Downloaded</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">{result.deletes_pushed + result.deletes_pulled}</div>
        <div class="metric-label">Deletes</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">{(result.duration_ms / 1000).toFixed(1)}s</div>
        <div class="metric-label">Duration</div>
      </div>
    </div>
  {/if}

  <h2 class="section-heading">Watermark</h2>
  <div class="watermark-table-wrap">
    <table class="watermark-table">
      <thead>
        <tr class="watermark-thead">
          <th class="watermark-th">Last synced up to</th>
          <th class="watermark-th align-right">Pending (dirty)</th>
        </tr>
      </thead>
      <tbody>
        <tr class="watermark-row">
          <td class="watermark-td muted" title={sync.watermark ?? ''}>{format_relative_time(sync.watermark) || '—'}</td>
          <td class="watermark-td align-right tabular">{sync.total_dirty}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <h2 class="section-heading">Live log</h2>
  <div bind:this={log_container} onscroll={handle_scroll} class="log-window">
    {#if log_entries.length === 0}
      <div class="log-empty">No logs yet — press Sync now</div>
    {:else}
      {#each log_entries as entry, index (index)}
        <div class="log-entry" style:color={level_color(entry.level)}>
          <span class="log-time">{format_time(entry.timestamp)}</span>
          <!-- -->
          <span class="log-phase">{entry.phase}</span>
          <!-- -->
          {#if entry.table}
            <span class="log-table">{entry.table}</span>
            <!-- -->
          {/if}
          <span class="log-msg">{entry.message}</span>
          {#if entry.row_count != null}
            <!-- --><span class="log-count">({entry.row_count})</span>
          {/if}
        </div>
        {#if entry.detail}
          <div class="log-detail">{entry.detail}</div>
        {/if}
      {/each}
    {/if}
  </div>

  <div class="history-header">
    <h2 class="section-heading inline-heading">History <span class="history-count">({sync.history.reports.length})</span></h2>
    {#if sync.history.reports.length > 0}
      <button
        type="button"
        class="btn-ghost clear-history"
        onclick={() => {
          if (confirm('Clear all sync history?'))
            sync.history.clear()
        }}>
        Clear history
      </button>
    {/if}
  </div>
  {#if sync.history.reports.length === 0}
    <p class="muted small">No previous syncs recorded.</p>
  {:else}
    <ul class="history-list">
      {#each sync.history.reports as report, index (report.started_at)}
        <li>
          <div
            role="button"
            tabindex="0"
            class="history-row"
            onclick={() => toggle_history(index)}
            onkeydown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                toggle_history(index)
              }
            }}>
            {#if report.success}
              <IconMdiCheckCircle style="color: var(--success)" />
            {:else}
              <IconMdiCloseCircle style="color: var(--danger)" />
            {/if}
            <span>{format_relative_time(report.started_at) || '—'}</span>
            <span class="history-summary">{report.summary}</span>
            <span class="history-duration">{(report.duration_ms / 1000).toFixed(1)}s</span>
            <button
              type="button"
              class="btn-ghost history-action-btn"
              title="Copy report"
              onclick={(event) => {
                event.stopPropagation()
                const text = generate_history_report_text({ report })
                navigator.clipboard.writeText(text)
                toast.success('Copied to clipboard')
              }}>
              <IconMdiContentCopy style="font-size: 0.875rem" />
            </button>
            <button
              type="button"
              class="btn-ghost history-action-btn"
              title="Delete from history"
              onclick={(event) => {
                event.stopPropagation()
                sync.history.remove(index)
                expanded_history.delete(index)
              }}>
              <IconMdiDeleteOutline style="font-size: 0.875rem" />
            </button>
            <IconMdiChevronDown class={['chevron', { rotated: expanded_history.has(index) }]} style="font-size: 0.875rem" />
          </div>
          {#if expanded_history.has(index)}
            <div class="history-detail-window">
              {#each report.entries as entry, entry_index (entry_index)}
                <div class="log-entry" style:color={level_color(entry.level)}>
                  <span class="log-time">{format_time(entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp))}</span>
                  <!-- -->
                  <span class="log-phase">{entry.phase}</span>
                  <!-- -->
                  {#if entry.table}
                    <span class="log-table">{entry.table}</span>
                    <!-- -->
                  {/if}
                  <span class="log-msg">{entry.message}</span>
                  {#if entry.row_count != null}
                    <!-- --><span class="log-count">({entry.row_count})</span>
                  {/if}
                </div>
                {#if entry.detail}
                  <div class="log-detail">{entry.detail}</div>
                {/if}
              {/each}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <h2 class="section-heading danger-heading">Danger zone</h2>
  <div class="danger-card">
    <div class="danger-text">
      <div class="danger-title">Delete local database</div>
      <div class="danger-body">
        Wipes your local admin DB (IndexedDB) and reloads. Everything synced from the server is re-downloaded from scratch. Any unsaved local writes are lost. Use this if things look out of sync.
      </div>
    </div>
    <button type="button" class="btn btn-default delete-db-btn" disabled={danger_busy || !user_id} onclick={delete_local_db}>
      <IconMdiDeleteForever style="margin-right: 0.25rem" />Delete local DB
    </button>
  </div>
{/if}

<style>
  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }
  .muted {
    color: var(--color-secondary);
  }
  .muted.small {
    font-size: 0.875rem;
  }

  .status-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .status-text-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }
  .status-label {
    font-size: 0.875rem;
    font-weight: 500;
  }
  .status-meta {
    font-size: 0.75rem;
    color: var(--color-secondary);
  }
  .status-error-text {
    font-size: 0.75rem;
    color: var(--danger);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .icon-btn {
    padding: 0.5rem;
  }

  .metric-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  @media (min-width: 640px) {
    .metric-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  .metric-card {
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface);
    text-align: center;
  }
  .metric-value {
    font-size: 1.5rem;
    font-weight: 700;
  }
  .metric-label {
    font-size: 0.75rem;
    color: var(--color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.25rem;
  }

  .section-heading {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }
  .section-heading.danger-heading {
    margin-top: 2.5rem;
    color: var(--danger);
  }

  .watermark-table-wrap {
    border-radius: 0.75rem;
    background: var(--surface);
    overflow: hidden;
    margin-bottom: 1.5rem;
  }
  .watermark-table {
    width: 100%;
    font-size: 0.875rem;
  }
  .watermark-thead {
    text-align: left;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-secondary);
  }
  .watermark-th {
    padding: 0.5rem 1rem;
    font-weight: 500;
  }
  .watermark-th.align-right {
    text-align: right;
  }
  .watermark-row {
    border-top: 1px solid var(--border-color);
  }
  .watermark-td {
    padding: 0.5rem 1rem;
  }
  .watermark-td.muted {
    color: var(--color-secondary);
  }
  .watermark-td.align-right {
    text-align: right;
  }
  .watermark-td.tabular {
    font-variant-numeric: tabular-nums;
  }

  .log-window {
    background: var(--surface);
    border-radius: 0.75rem;
    padding: 0.75rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    max-height: 24rem;
    min-height: 8rem;
    overflow: auto;
    margin-bottom: 2rem;
  }
  .log-empty {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-secondary);
    padding-top: 1.5rem;
    padding-bottom: 1.5rem;
  }
  .log-entry {
    padding: 0.125rem 0;
    line-height: 1.625;
  }
  .log-time {
    color: var(--color-secondary);
    user-select: none;
  }
  .log-phase {
    padding: 0 0.25rem;
    border-radius: 0.25rem;
    background: var(--background);
    color: var(--color-secondary);
    user-select: none;
  }
  .log-table {
    padding: 0 0.25rem;
    border-radius: 0.25rem;
    background: var(--primary);
    color: var(--on-primary);
    user-select: none;
    opacity: 0.75;
  }
  .log-msg {
    word-break: break-all;
  }
  .log-count {
    color: var(--color-secondary);
  }
  .log-detail {
    margin-left: 1rem;
    color: var(--color-secondary);
    padding: 0.125rem 0;
    word-break: break-all;
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  .section-heading.inline-heading {
    margin-bottom: 0;
  }
  .history-count {
    color: var(--color-secondary);
    font-weight: 400;
  }
  .clear-history {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }
  .history-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .history-row {
    display: grid;
    grid-template-columns: auto auto 1fr auto auto auto auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    background: var(--surface);
    transition: opacity 0.15s;
    font-size: 0.875rem;
    cursor: pointer;
  }
  .history-row:hover {
    opacity: 0.9;
  }
  .history-summary {
    color: var(--color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .history-duration {
    color: var(--color-secondary);
    font-variant-numeric: tabular-nums;
  }
  .history-action-btn {
    padding: 0.25rem;
    margin: -0.25rem;
  }
  :global(.chevron) {
    transition: transform 0.15s;
  }
  :global(.chevron.rotated) {
    transform: rotate(180deg);
  }
  .history-detail-window {
    background: var(--surface);
    border-radius: 0.5rem;
    padding: 0.75rem;
    margin-top: 0.25rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    max-height: 18rem;
    overflow: auto;
  }

  .danger-card {
    border-radius: 0.75rem;
    border: 1px solid var(--danger);
    padding: 1rem;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .danger-text {
    flex: 1;
    min-width: 12.5rem;
  }
  .danger-title {
    font-weight: 500;
  }
  .danger-body {
    font-size: 0.875rem;
    color: var(--color-secondary);
    margin-top: 0.25rem;
  }
  .delete-db-btn {
    background: var(--danger);
    color: white;
  }
  .delete-db-btn:hover {
    background: var(--danger);
    opacity: 0.9;
  }
</style>
