import type { TranslateSummaryResponse } from '$api/translate/summary/+server'
import type { I18nTranslationRow, TranslateRow } from '$lib/server/i18n/i18n-db'
import { api_translate_approve } from '$api/translate/approve/_call'
import { api_translate_data } from '$api/translate/data/_call'
import { api_translate_save } from '$api/translate/save/_call'
import { api_translate_summary } from '$api/translate/summary/_call'
import { toast } from '$lib/svelte-pieces/toast.svelte'

/**
 * Reactive state for /translate (chat-store pattern: a singleton the page
 * reads; stories seed it directly). Server-authoritative — every write goes
 * through /api/translate/* and the response is folded back into `rows`.
 */
class TranslateStore {
  locale = $state('')
  rows = $state<TranslateRow[]>([])
  loading = $state(false)
  summary = $state<TranslateSummaryResponse | null>(null)

  async load_locale(locale: string) {
    this.locale = locale
    this.loading = true
    const { data, error } = await api_translate_data({ locale })
    if (this.locale !== locale)
      return // switched again mid-flight
    this.loading = false
    if (error) {
      toast.error(`Could not load ${locale}: ${error.message}`)
      return
    }
    this.rows = data.rows
  }

  async refresh_summary() {
    const { data } = await api_translate_summary()
    if (data)
      this.summary = data
  }

  /** Fold a saved/approved server row (or a deletion) back into `rows`. */
  private apply({ key_id, row }: { key_id: string, row: I18nTranslationRow | null }) {
    const index = this.rows.findIndex(entry => entry.key_id === key_id)
    if (index === -1)
      return
    this.rows[index] = {
      ...this.rows[index],
      value: row?.value ?? null,
      source: row?.source ?? null,
      needs_review: row?.needs_review ?? null,
      updated_at: row?.updated_at ?? null,
      updated_by_name: row?.updated_by_name ?? null,
    }
  }

  /** Returns true on success (the row component keeps its draft on failure). */
  async save({ key_id, value }: { key_id: string, value: string }): Promise<boolean> {
    const { data, error } = await api_translate_save({ key_id, locale: this.locale, value })
    if (error) {
      toast.error(`Save failed: ${error.message}`)
      return false
    }
    this.apply({ key_id, row: data.row })
    return true
  }

  async approve({ key_id }: { key_id: string }): Promise<boolean> {
    const { data, error } = await api_translate_approve({ key_id, locale: this.locale })
    if (error) {
      toast.error(`Approve failed: ${error.message}`)
      return false
    }
    this.apply({ key_id, row: data.row })
    return true
  }
}

export const translate_store = new TranslateStore()
