<script lang="ts">
  import { page } from '$app/state'
  import { tick } from 'svelte'
  import { download_sync_report, generate_sync_report_text } from './download-report.js'

  const sync = $derived(page.data.sync)
  const log_entries = $derived(sync?.log_entries ?? [])
  const result = $derived(sync?.last_sync_result)

  let log_container: HTMLDivElement | undefined = $state()
  let auto_scroll = $state(true)

  $effect(() => {
    log_entries.length
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

  async function start_sync() {
    if (!sync || sync.is_syncing)
      return
    await sync.sync()
  }

  function handle_download() {
    if (!sync)
      return
    download_sync_report({
      log_entries: sync.log_entries,
      result: sync.last_sync_result,
    })
  }

  async function handle_copy() {
    if (!sync)
      return
    const text = generate_sync_report_text({
      log_entries: sync.log_entries,
      result: sync.last_sync_result,
    })
    await navigator.clipboard.writeText(text)
  }

  function format_time(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })
  }
</script>

<div class="flex flex-col gap-3" style="height: calc(100vh - 140px);">
  <!-- Status + Actions Bar -->
  <div class="flex items-center gap-2">
    <div class="flex items-center gap-2 flex-1 min-w-0">
      {#if sync?.is_syncing}
        <span class="i-mdi-loading animate-spin text-lg text-blue-600"></span>
        <span class="text-sm font-medium">Syncing...</span>
      {:else if result?.success}
        <span class="i-mdi-check-circle text-lg text-green-600"></span>
        <span class="text-sm font-medium">Sync complete</span>
        <span class="text-xs text-gray-500">{result.duration_ms}ms</span>
      {:else if result && !result.success}
        <span class="i-mdi-alert-circle text-lg text-red-600"></span>
        <span class="text-sm font-medium">Sync error</span>
      {:else}
        <span class="text-sm text-gray-500">Sync</span>
      {/if}
    </div>

    <button
      type="button"
      class="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
      disabled={sync?.is_syncing}
      onclick={start_sync}>
      <span class="i-mdi-sync mr-1"></span>
      Start Sync
    </button>

    <button
      type="button"
      class="p-1.5 hover:bg-gray-100 rounded disabled:opacity-50"
      disabled={log_entries.length === 0}
      onclick={handle_copy}
      title="Copy to clipboard">
      <span class="i-mdi-content-copy text-lg"></span>
    </button>

    <button
      type="button"
      class="p-1.5 hover:bg-gray-100 rounded disabled:opacity-50"
      disabled={log_entries.length === 0}
      onclick={handle_download}
      title="Download report">
      <span class="i-mdi-download text-lg"></span>
    </button>
  </div>

  <!-- Summary Cards -->
  {#if result}
    <div class="grid grid-cols-4 gap-2">
      <div class="bg-gray-100 rounded-lg p-2 text-center">
        <div class="text-lg font-bold">{result.items_uploaded}</div>
        <div class="text-xs text-gray-500">Rows uploaded</div>
      </div>
      <div class="bg-gray-100 rounded-lg p-2 text-center">
        <div class="text-lg font-bold">{result.items_downloaded}</div>
        <div class="text-xs text-gray-500">Rows downloaded</div>
      </div>
      <div class="bg-gray-100 rounded-lg p-2 text-center">
        <div class="text-lg font-bold">{result.deletes_pushed + result.deletes_pulled}</div>
        <div class="text-xs text-gray-500">Deletes synced</div>
      </div>
      <div class="bg-gray-100 rounded-lg p-2 text-center">
        <div class="text-lg font-bold" class:text-red-600={result.errors.length > 0}>{result.errors.length}</div>
        <div class="text-xs text-gray-500">Errors</div>
      </div>
    </div>
  {/if}

  <!-- Log Stream -->
  <div
    bind:this={log_container}
    onscroll={handle_scroll}
    class="flex-1 overflow-y-auto bg-gray-100 rounded-lg p-2 min-h-0">
    {#if log_entries.length === 0}
      <div class="h-full flex items-center justify-center text-gray-500 text-sm">
        No sync logs yet
      </div>
    {:else}
      <div class="flex flex-col">
        {#each log_entries as entry, index (index)}
          <div
            class="text-xs font-mono py-0.5 px-1 rounded
              hover:bg-white transition-colors"
            class:text-red-600={entry.level === 'error'}
            class:text-green-600={entry.level === 'success'}
            class:text-amber-600={entry.level === 'warn'}>
            <span class="text-gray-500 select-none">{format_time(entry.timestamp)}</span>
            <!-- -->
            <span class="px-1 rounded bg-white text-gray-500 select-none">{entry.phase}</span>
            <!-- -->
            {#if entry.table}
              <span class="px-1 rounded bg-blue-600 text-white select-none opacity-75">{entry.table}</span>
              <!-- -->
            {/if}
            {entry.message}
            {#if entry.row_count != null}
              <!-- --><span class="text-gray-500">({entry.row_count})</span>
            {/if}
          </div>

          {#if entry.detail}
            <div class="ml-4 text-xs text-gray-500 font-mono py-0.5">
              {entry.detail}
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>
