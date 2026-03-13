import type { SyncLogEntry, SyncResult } from '$lib/pglite/sync/types'

export function generate_sync_report_text({ log_entries, result }: {
  log_entries: SyncLogEntry[]
  result: SyncResult | null
}): string {
  const lines: string[] = []
  lines.push(`Sync Report — ${new Date().toISOString()}`)
  lines.push(`User Agent: ${navigator.userAgent}`)
  lines.push('')
  if (result) {
    lines.push('=== Summary ===')
    lines.push(`Success: ${result.success}`)
    lines.push(`Duration: ${result.duration_ms}ms`)
    lines.push(`Uploaded: ${result.items_uploaded}`)
    lines.push(`Downloaded: ${result.items_downloaded}`)
    lines.push(`Deletes pushed: ${result.deletes_pushed}`)
    lines.push(`Deletes pulled: ${result.deletes_pulled}`)
    lines.push(`Errors: ${result.errors.length}`)
    lines.push('')
  }

  lines.push('=== Log ===')
  for (const entry of log_entries) {
    const time = entry.timestamp.toISOString()
    const table_part = entry.table ? ` [${entry.table}]` : ''
    const count_part = entry.row_count != null ? ` (${entry.row_count} rows)` : ''
    lines.push(`${time} [${entry.level.toUpperCase()}] ${entry.phase}${table_part}: ${entry.message}${count_part}`)
    if (entry.detail) {
      lines.push(`  Detail: ${entry.detail}`)
    }
  }

  return lines.join('\n')
}

export function download_sync_report(options: {
  log_entries: SyncLogEntry[]
  result: SyncResult | null
}) {
  const text = generate_sync_report_text(options)
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const date_str = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  anchor.href = url
  anchor.download = `sync-report-${date_str}.txt`
  anchor.click()
  URL.revokeObjectURL(url)
}
