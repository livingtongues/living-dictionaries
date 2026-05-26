import type { SyncLogEntry, SyncReport, SyncResult } from './types'

const STORAGE_KEY = 'sync_history'
const MAX_REPORTS = 20

export class SyncHistory {
  reports = $state<SyncReport[]>([])

  constructor() {
    this.#load()
  }

  save_report({ result, log_entries, started_at }: {
    result: SyncResult
    log_entries: SyncLogEntry[]
    started_at: Date
  }) {
    /* eslint-disable svelte/prefer-svelte-reactivity */
    const report: SyncReport = {
      started_at: started_at.toISOString(),
      finished_at: new Date().toISOString(),
      success: result.success,
      summary: `${result.items_uploaded}↑ ${result.items_downloaded}↓ ${result.deletes_pushed + result.deletes_pulled}🗑`,
      duration_ms: result.duration_ms,
      items_uploaded: result.items_uploaded,
      items_downloaded: result.items_downloaded,
      deletes_pushed: result.deletes_pushed,
      deletes_pulled: result.deletes_pulled,
      error: result.error,
      entries: log_entries.map(entry => ({
        ...entry,
        timestamp: entry.timestamp instanceof Date ? entry.timestamp : new Date(entry.timestamp),
      })),
    }
    /* eslint-enable svelte/prefer-svelte-reactivity */
    this.reports = [report, ...this.reports].slice(0, MAX_REPORTS)
    this.#persist()
  }

  remove(index: number) {
    this.reports = this.reports.filter((_, i) => i !== index)
    this.#persist()
  }

  clear() {
    this.reports = []
    this.#persist()
  }

  #load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as SyncReport[]
        this.reports = parsed.map(report => ({
          ...report,
          // eslint-disable-next-line svelte/prefer-svelte-reactivity
          entries: report.entries.map(entry => ({ ...entry, timestamp: new Date(entry.timestamp) })),
        }))
      }
    } catch {
      // ignore corrupt data
    }
  }

  #persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.reports))
    } catch {
      try {
        this.reports = this.reports.slice(0, 10)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.reports))
      } catch {
        // localStorage unavailable (e.g. tests)
      }
    }
  }
}
