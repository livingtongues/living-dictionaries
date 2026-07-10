/**
 * Build the full non-English translation set shaped EXACTLY like the
 * committed `$lib/i18n/locales/**` files, keyed by relative file path
 * (`es.json`, `gl/es.json`, …). Consumed by the public `/api/i18n/export`
 * endpoint, which the Dockerfile bake step (`site/scripts/fetch-baked-i18n.mjs`)
 * fetches from the RUNNING prod site during `docker compose build` — the image
 * build can't see `/data`, but the old container is still serving. English
 * files are never emitted (code is their source of truth).
 */
import type Database from 'better-sqlite3'
import { TRANSLATABLE_LOCALES } from '$lib/i18n/locales'

/** Sections that live in their own per-locale files (a sheet-tab-era layout we keep for the loader). */
export const FILE_SECTIONS = ['gl', 'ps', 'psAbbrev', 'sd'] as const

/** In-memory Map key separator joining `locale` + `key_id`; a NUL keeps it collision-proof against real ids. */
const KEY_SEP = '\0'

export interface I18nExportBody {
  generated_at: string
  /** relative path under `src/lib/i18n/locales/` → parsed file content */
  files: Record<string, Record<string, Record<string, string>>>
}

export function export_locale_files({ db }: { db: Database.Database }): I18nExportBody {
  const keys = db.prepare('SELECT id FROM i18n_keys WHERE removed_at IS NULL ORDER BY rowid').all() as { id: string }[]
  const translations = db.prepare(`
    SELECT t.key_id, t.locale, t.value FROM i18n_translations t
    JOIN i18n_keys k ON k.id = t.key_id AND k.removed_at IS NULL`).all() as { key_id: string, locale: string, value: string }[]
  const value_by_locale_key = new Map(translations.map(row => [`${row.locale}${KEY_SEP}${row.key_id}`, row.value]))

  const files: I18nExportBody['files'] = {}
  for (const locale of TRANSLATABLE_LOCALES) {
    const base: Record<string, Record<string, string>> = {}
    const section_files: Record<string, Record<string, string>> = { gl: {}, ps: {}, psAbbrev: {}, sd: {} }
    for (const { id } of keys) {
      const period = id.indexOf('.')
      const section = id.slice(0, period)
      const item = id.slice(period + 1)
      // Missing translations emit '' to match the sheet-era file convention —
      // the loader treats falsy as "fall back to English".
      const value = value_by_locale_key.get(`${locale}${KEY_SEP}${id}`) ?? ''
      if ((FILE_SECTIONS as readonly string[]).includes(section)) {
        section_files[section][item] = value
      } else {
        base[section] ??= {}
        base[section][item] = value
      }
    }
    files[`${locale}.json`] = base
    for (const section of FILE_SECTIONS)
      files[`${section}/${locale}.json`] = { [section]: section_files[section] }
  }
  return { generated_at: new Date().toISOString(), files }
}

if (import.meta.vitest) {
  describe(export_locale_files, () => {
    test('mirrors the locales file layout with values filled and misses as empty strings', async () => {
      const { open_test_shared_db } = await import('$lib/db/server/shared-db')
      const { sync_en_catalog, upsert_translation } = await import('./i18n-db')
      const db = open_test_shared_db()
      sync_en_catalog({ db })
      upsert_translation({ db, key_id: 'misc.add', locale: 'es', value: 'Agregar', source: 'human' })
      upsert_translation({ db, key_id: 'ps.pr.n', locale: 'es', value: 'n.pr.', source: 'human' })

      const { files } = export_locale_files({ db })
      expect(files['es.json'].misc.add).toBe('Agregar')
      expect(files['es.json'].misc.edit).toBe('')
      expect(files['ps/es.json'].ps['pr.n']).toBe('n.pr.') // dotted item survives the first-period split
      expect(files['es.json'].ps).toBeUndefined() // file sections stay out of the base file
      expect(files['en.json']).toBeUndefined() // English is code-owned
      expect(Object.keys(files)).toContain('gl/fr.json')
      db.close()
    })
  })
}
