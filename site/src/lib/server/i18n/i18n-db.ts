/**
 * Server-authoritative data layer for the DB-backed translation system
 * (/translate). English lives in code (`$lib/i18n/locales/*en.json`) and is
 * mirrored into `i18n_keys` at boot (`sync_en_catalog`); every non-English
 * value is an `i18n_translations` row reached ONLY through these helpers +
 * the `/api/translate/*` endpoints — never a sync sector (like chat). Raw
 * better-sqlite3 statements; no JSON columns.
 */
import type Database from 'better-sqlite3'
import { locale_from_catalog_path, TRANSLATABLE_LOCALES } from '$lib/i18n/locales'
import { en } from '$lib/i18n'

export type I18nSource = 'import' | 'human' | 'ai'
export type ReviewReason = 'ai' | 'en_changed'

export interface I18nKeyRow {
  id: string
  en_value: string
  en_updated_at: string
  created_at: string
  removed_at: string | null
}

export interface I18nTranslationRow {
  id: string
  key_id: string
  locale: string
  value: string
  source: I18nSource
  needs_review: ReviewReason | null
  updated_by_user_id: string | null
  updated_by_name: string | null
  created_at: string
  updated_at: string
}

/** One key as the /translate UI sees it: EN source + the locale's translation (if any). */
export interface TranslateRow {
  key_id: string
  en_value: string
  en_updated_at: string
  value: string | null
  source: I18nSource | null
  needs_review: ReviewReason | null
  updated_at: string | null
  updated_by_name: string | null
}

export interface LocaleStats {
  locale: string
  total: number
  translated: number
  /** Total needing review (`flagged_ai + flagged_en_changed`). */
  flagged: number
  flagged_ai: number
  flagged_en_changed: number
  missing: number
}

export interface TranslatorInfo {
  user_id: string
  name: string | null
  email: string | null
  locales: string[]
}

function now_iso(): string {
  return new Date().toISOString()
}

/**
 * The merged `en` object is `{ section: { item: value } }`; the full key is
 * `section.item` where the ITEM may itself contain dots (`ps.pr.n`) — reading
 * a key back always splits on the FIRST period only (`splitByFirstPeriod`).
 */
export function flatten_en(): Record<string, string> {
  const flattened: Record<string, string> = {}
  for (const [section, items] of Object.entries(en)) {
    for (const [item, value] of Object.entries(items as Record<string, string>))
      flattened[`${section}.${item}`] = value
  }
  return flattened
}

export interface CatalogSyncResult {
  added: number
  changed: number
  removed: number
  restored: number
}

/**
 * Mirror the code's English catalog into `i18n_keys`. Runs at every server
 * boot, so a key added by an agent in code shows up in the translator UI on
 * the next deploy with no manual step:
 * - new key → INSERT
 * - changed en_value → UPDATE + flag that key's translations `en_changed`
 *   (the AI slash command later triages: trivial English tweak → fix + clear;
 *   substantive → draft + leave for the translator). An existing 'ai' flag is
 *   NOT downgraded — both reasons mean "flagged" and 'ai' is more specific.
 * - key gone from code → soft-delete (`removed_at`); returns → restore.
 */
export function sync_en_catalog({ db }: { db: Database.Database }): CatalogSyncResult {
  const result: CatalogSyncResult = { added: 0, changed: 0, removed: 0, restored: 0 }
  const flattened = flatten_en()
  const existing_rows = db.prepare('SELECT id, en_value, removed_at FROM i18n_keys').all() as Pick<I18nKeyRow, 'id' | 'en_value' | 'removed_at'>[]
  const existing = new Map(existing_rows.map(row => [row.id, row]))

  const insert = db.prepare('INSERT INTO i18n_keys (id, en_value, en_updated_at, created_at) VALUES (?, ?, ?, ?)')
  const update_value = db.prepare('UPDATE i18n_keys SET en_value = ?, en_updated_at = ?, removed_at = NULL WHERE id = ?')
  const restore = db.prepare('UPDATE i18n_keys SET removed_at = NULL WHERE id = ?')
  const soft_delete = db.prepare('UPDATE i18n_keys SET removed_at = ? WHERE id = ?')
  const flag_translations = db.prepare('UPDATE i18n_translations SET needs_review = \'en_changed\', updated_at = ? WHERE key_id = ? AND needs_review IS NULL')

  const run_sync = db.transaction(() => {
    const now = now_iso()
    for (const [key_id, en_value] of Object.entries(flattened)) {
      const row = existing.get(key_id)
      if (!row) {
        insert.run(key_id, en_value, now, now)
        result.added++
        continue
      }
      if (row.en_value !== en_value) {
        update_value.run(en_value, now, key_id)
        flag_translations.run(now, key_id)
        result.changed++
      } else if (row.removed_at) {
        restore.run(key_id)
        result.restored++
      }
    }
    for (const row of existing_rows) {
      if (!(row.id in flattened) && !row.removed_at) {
        soft_delete.run(now, row.id)
        result.removed++
      }
    }
  })
  run_sync()
  return result
}

/**
 * One-time cutover import + fresh-dev seed: when `i18n_translations` is empty,
 * load the committed locale files (the final Google-Sheet snapshot) into the
 * DB. Lazy glob so the ~100 JSON chunks only load when actually seeding.
 * Rows land as source='import'. Empty-string values (sheet-era "untranslated")
 * are skipped — missing translation = no row. INSERT OR IGNORE keeps the
 * blue/green double-boot race harmless.
 */
type CatalogModules = Record<string, () => Promise<unknown>>

export async function seed_translations_if_empty({ db, catalog_modules = import.meta.glob('$lib/i18n/locales/**/*.json') }: {
  db: Database.Database
  catalog_modules?: CatalogModules
}): Promise<boolean> {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM i18n_translations').get() as { count: number }
  if (count > 0)
    return false

  const insert = db.prepare(`
    INSERT OR IGNORE INTO i18n_translations (id, key_id, locale, value, source, created_at, updated_at)
    SELECT ?, id, ?, ?, 'import', ?, ? FROM i18n_keys WHERE id = ?`)
  const now = now_iso()

  for (const [path, load] of Object.entries(catalog_modules)) {
    const locale = locale_from_catalog_path(path)
    if (!locale)
      continue
    const module = await load() as { default: Record<string, Record<string, string>> }
    for (const [section, items] of Object.entries(module.default)) {
      for (const [item, value] of Object.entries(items)) {
        if (typeof value !== 'string' || !value.trim())
          continue
        insert.run(crypto.randomUUID(), locale, value, now, now, `${section}.${item}`)
      }
    }
  }
  return true
}

/** All active keys + this locale's translations, in catalog (≈ code) order. */
export function list_locale_rows({ db, locale }: { db: Database.Database, locale: string }): TranslateRow[] {
  return db.prepare(`
    SELECT k.id as key_id, k.en_value, k.en_updated_at,
      t.value, t.source, t.needs_review, t.updated_at, t.updated_by_name
    FROM i18n_keys k
    LEFT JOIN i18n_translations t ON t.key_id = k.id AND t.locale = ?
    WHERE k.removed_at IS NULL
    ORDER BY k.rowid`).all(locale) as TranslateRow[]
}

export class I18nError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * Write one translation. Empty/whitespace value deletes the row (missing =
 * no row). Returns the stored row, or null when deleted.
 */
export function upsert_translation({ db, key_id, locale, value, source, needs_review = null, updated_by_user_id = null, updated_by_name = null }: {
  db: Database.Database
  key_id: string
  locale: string
  value: string
  source: I18nSource
  needs_review?: ReviewReason | null
  updated_by_user_id?: string | null
  updated_by_name?: string | null
}): I18nTranslationRow | null {
  if (!(TRANSLATABLE_LOCALES as string[]).includes(locale))
    throw new I18nError(`Unknown locale: ${locale}`, 400)
  const key = db.prepare('SELECT id, removed_at FROM i18n_keys WHERE id = ?').get(key_id) as Pick<I18nKeyRow, 'id' | 'removed_at'> | undefined
  if (!key || key.removed_at)
    throw new I18nError('Unknown key', 404)

  const now = now_iso()
  if (!value.trim()) {
    db.prepare('DELETE FROM i18n_translations WHERE key_id = ? AND locale = ?').run(key_id, locale)
    return null
  }
  db.prepare(`
    INSERT INTO i18n_translations (id, key_id, locale, value, source, needs_review, updated_by_user_id, updated_by_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (key_id, locale) DO UPDATE SET
      value = excluded.value, source = excluded.source, needs_review = excluded.needs_review,
      updated_by_user_id = excluded.updated_by_user_id, updated_by_name = excluded.updated_by_name,
      updated_at = excluded.updated_at`)
    .run(crypto.randomUUID(), key_id, locale, value, source, needs_review, updated_by_user_id, updated_by_name, now, now)
  return db.prepare('SELECT * FROM i18n_translations WHERE key_id = ? AND locale = ?').get(key_id, locale) as I18nTranslationRow
}

/** A translator confirms a flagged (AI / en_changed) value is good as-is. */
export function approve_translation({ db, key_id, locale, updated_by_user_id, updated_by_name }: {
  db: Database.Database
  key_id: string
  locale: string
  updated_by_user_id: string
  updated_by_name: string | null
}): I18nTranslationRow {
  const changes = db.prepare(`
    UPDATE i18n_translations SET needs_review = NULL, source = 'human',
      updated_by_user_id = ?, updated_by_name = ?, updated_at = ?
    WHERE key_id = ? AND locale = ?`)
    .run(updated_by_user_id, updated_by_name, now_iso(), key_id, locale)
  if (!changes.changes)
    throw new I18nError('No translation to approve', 404)
  return db.prepare('SELECT * FROM i18n_translations WHERE key_id = ? AND locale = ?').get(key_id, locale) as I18nTranslationRow
}

/** Per-locale progress across every translatable locale (zeros included). */
export function get_locale_stats({ db }: { db: Database.Database }): LocaleStats[] {
  const { total } = db.prepare('SELECT COUNT(*) as total FROM i18n_keys WHERE removed_at IS NULL').get() as { total: number }
  const rows = db.prepare(`
    SELECT t.locale,
      COUNT(*) as translated,
      SUM(t.needs_review = 'ai') as flagged_ai,
      SUM(t.needs_review = 'en_changed') as flagged_en_changed
    FROM i18n_translations t
    JOIN i18n_keys k ON k.id = t.key_id AND k.removed_at IS NULL
    GROUP BY t.locale`).all() as { locale: string, translated: number, flagged_ai: number, flagged_en_changed: number }[]
  const by_locale = new Map(rows.map(row => [row.locale, row]))
  return TRANSLATABLE_LOCALES.map((locale) => {
    const row = by_locale.get(locale)
    const translated = row?.translated ?? 0
    const flagged_ai = row?.flagged_ai ?? 0
    const flagged_en_changed = row?.flagged_en_changed ?? 0
    return { locale, total, translated, flagged: flagged_ai + flagged_en_changed, flagged_ai, flagged_en_changed, missing: total - translated }
  })
}

export function get_translator_locales({ db, user_id }: { db: Database.Database, user_id: string }): string[] {
  const rows = db.prepare('SELECT locale FROM translator_languages WHERE user_id = ? ORDER BY locale').all(user_id) as { locale: string }[]
  return rows.map(row => row.locale)
}

export function add_translator_language({ db, user_id, locale }: { db: Database.Database, user_id: string, locale: string }): void {
  if (!(TRANSLATABLE_LOCALES as string[]).includes(locale))
    throw new I18nError(`Unknown locale: ${locale}`, 400)
  db.prepare('INSERT OR IGNORE INTO translator_languages (id, user_id, locale) VALUES (?, ?, ?)')
    .run(crypto.randomUUID(), user_id, locale)
}

export function remove_translator_language({ db, user_id, locale }: { db: Database.Database, user_id: string, locale: string }): void {
  db.prepare('DELETE FROM translator_languages WHERE user_id = ? AND locale = ?').run(user_id, locale)
}

/** Everyone with ≥1 assignment, with their locale list (for the admin panel + notify). */
export function list_translators({ db }: { db: Database.Database }): TranslatorInfo[] {
  const rows = db.prepare(`
    SELECT tl.user_id, tl.locale, u.name, u.email
    FROM translator_languages tl
    JOIN users u ON u.id = tl.user_id
    ORDER BY u.name, tl.locale`).all() as { user_id: string, locale: string, name: string | null, email: string | null }[]
  const translators = new Map<string, TranslatorInfo>()
  for (const row of rows) {
    const translator = translators.get(row.user_id) || { user_id: row.user_id, name: row.name, email: row.email, locales: [] }
    translator.locales.push(row.locale)
    translators.set(row.user_id, translator)
  }
  return [...translators.values()]
}

if (import.meta.vitest) {
  const { open_test_shared_db } = await import('$lib/db/server/shared-db')

  function make_db() {
    const db = open_test_shared_db()
    db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, \'[]\', ?, ?)')
      .run('u-1', 'translator@example.com', 'Tina', '2026-01-01', '2026-01-01')
    return db
  }

  describe(flatten_en, () => {
    test('produces first-period-splittable dotted keys', () => {
      const flattened = flatten_en()
      expect(flattened['misc.add']).toBeTruthy()
      expect(flattened['ps.pr.n']).toBeTruthy() // item itself contains a dot
      expect(Object.keys(flattened).length).toBeGreaterThan(900)
    })
  })

  describe(sync_en_catalog, () => {
    test('inserts the full catalog on first run, idempotent on second', () => {
      const db = make_db()
      const first = sync_en_catalog({ db })
      expect(first.added).toBe(Object.keys(flatten_en()).length)
      const second = sync_en_catalog({ db })
      expect(second).toEqual({ added: 0, changed: 0, removed: 0, restored: 0 })
      db.close()
    })

    test('en change flags existing translations en_changed but never downgrades an ai flag', () => {
      const db = make_db()
      sync_en_catalog({ db })
      upsert_translation({ db, key_id: 'misc.add', locale: 'es', value: 'Agregar', source: 'human' })
      upsert_translation({ db, key_id: 'misc.add', locale: 'fr', value: 'Ajouter', source: 'ai', needs_review: 'ai' })
      db.prepare('UPDATE i18n_keys SET en_value = \'CHANGED\' WHERE id = ?').run('misc.add')

      const result = sync_en_catalog({ db })
      expect(result.changed).toBe(1)
      const spanish = db.prepare('SELECT needs_review FROM i18n_translations WHERE key_id = ? AND locale = ?').get('misc.add', 'es') as { needs_review: string }
      expect(spanish.needs_review).toBe('en_changed')
      const french = db.prepare('SELECT needs_review FROM i18n_translations WHERE key_id = ? AND locale = ?').get('misc.add', 'fr') as { needs_review: string }
      expect(french.needs_review).toBe('ai')
      db.close()
    })

    test('soft-deletes keys missing from code and restores them when they return', () => {
      const db = make_db()
      sync_en_catalog({ db })
      db.prepare('INSERT INTO i18n_keys (id, en_value) VALUES (?, ?)').run('ghost.key', 'Boo')
      const removed_run = sync_en_catalog({ db })
      expect(removed_run.removed).toBe(1)
      db.prepare('UPDATE i18n_keys SET removed_at = \'2026-01-01\' WHERE id = ?').run('misc.add')
      const restored_run = sync_en_catalog({ db })
      expect(restored_run.restored).toBe(1)
      db.close()
    })
  })

  describe(seed_translations_if_empty, () => {
    test('seeds committed locale files once, skipping empty values', async () => {
      const db = make_db()
      sync_en_catalog({ db })
      const seeded = await seed_translations_if_empty({ db })
      expect(seeded).toBe(true)
      const { count } = db.prepare('SELECT COUNT(*) as count FROM i18n_translations').get() as { count: number }
      expect(count).toBeGreaterThan(1000)
      const { empties } = db.prepare('SELECT COUNT(*) as empties FROM i18n_translations WHERE TRIM(value) = \'\'').get() as { empties: number }
      expect(empties).toBe(0)
      const { english } = db.prepare('SELECT COUNT(*) as english FROM i18n_translations WHERE locale = \'en\'').get() as { english: number }
      expect(english).toBe(0)
      const again = await seed_translations_if_empty({ db })
      expect(again).toBe(false)
      db.close()
    }, 15_000)
  })

  describe(upsert_translation, () => {
    test('inserts, updates, and deletes on empty value', () => {
      const db = make_db()
      sync_en_catalog({ db })
      const row = upsert_translation({ db, key_id: 'misc.add', locale: 'es', value: 'Agregar', source: 'human', updated_by_user_id: 'u-1', updated_by_name: 'Tina' })
      expect(row?.value).toBe('Agregar')
      expect(row?.updated_by_name).toBe('Tina')
      const updated = upsert_translation({ db, key_id: 'misc.add', locale: 'es', value: 'Añadir', source: 'human' })
      expect(updated?.value).toBe('Añadir')
      const deleted = upsert_translation({ db, key_id: 'misc.add', locale: 'es', value: '  ', source: 'human' })
      expect(deleted).toBeNull()
      const rows = list_locale_rows({ db, locale: 'es' })
      expect(rows.find(entry => entry.key_id === 'misc.add')?.value).toBeNull()
      db.close()
    })

    test('rejects unknown keys and locales', () => {
      const db = make_db()
      sync_en_catalog({ db })
      expect(() => upsert_translation({ db, key_id: 'nope.nope', locale: 'es', value: 'x', source: 'human' })).toThrow(I18nError)
      expect(() => upsert_translation({ db, key_id: 'misc.add', locale: 'xx', value: 'x', source: 'human' })).toThrow(I18nError)
      db.close()
    })
  })

  describe(approve_translation, () => {
    test('clears the flag and attributes the approver', () => {
      const db = make_db()
      sync_en_catalog({ db })
      upsert_translation({ db, key_id: 'misc.add', locale: 'es', value: 'Agregar', source: 'ai', needs_review: 'ai' })
      const approved = approve_translation({ db, key_id: 'misc.add', locale: 'es', updated_by_user_id: 'u-1', updated_by_name: 'Tina' })
      expect(approved.needs_review).toBeNull()
      expect(approved.source).toBe('human')
      expect(approved.updated_by_name).toBe('Tina')
      expect(() => approve_translation({ db, key_id: 'misc.add', locale: 'fr', updated_by_user_id: 'u-1', updated_by_name: 'Tina' })).toThrow(I18nError)
      db.close()
    })
  })

  describe(get_locale_stats, () => {
    test('counts translated + flagged (split by review reason) per locale with zeros for untouched locales', () => {
      const db = make_db()
      sync_en_catalog({ db })
      upsert_translation({ db, key_id: 'misc.add', locale: 'es', value: 'Agregar', source: 'human' })
      upsert_translation({ db, key_id: 'misc.edit', locale: 'es', value: 'Editar', source: 'ai', needs_review: 'ai' })
      upsert_translation({ db, key_id: 'header.contact_us', locale: 'es', value: 'Contáctenos', source: 'human', needs_review: 'en_changed' })
      const stats = get_locale_stats({ db })
      const spanish = stats.find(stat => stat.locale === 'es')
      const total = Object.keys(flatten_en()).length
      expect(spanish).toEqual({ locale: 'es', total, translated: 3, flagged: 2, flagged_ai: 1, flagged_en_changed: 1, missing: total - 3 })
      const hausa = stats.find(stat => stat.locale === 'ha')
      expect(hausa?.translated).toBe(0)
      db.close()
    })
  })

  describe(add_translator_language, () => {
    test('assignment round-trip: add, list, remove', () => {
      const db = make_db()
      add_translator_language({ db, user_id: 'u-1', locale: 'es' })
      add_translator_language({ db, user_id: 'u-1', locale: 'es' }) // idempotent
      add_translator_language({ db, user_id: 'u-1', locale: 'fr' })
      expect(get_translator_locales({ db, user_id: 'u-1' })).toEqual(['es', 'fr'])
      expect(list_translators({ db })).toEqual([{ user_id: 'u-1', name: 'Tina', email: 'translator@example.com', locales: ['es', 'fr'] }])
      expect(() => add_translator_language({ db, user_id: 'u-1', locale: 'en' })).toThrow(I18nError)
      remove_translator_language({ db, user_id: 'u-1', locale: 'es' })
      expect(get_translator_locales({ db, user_id: 'u-1' })).toEqual(['fr'])
      db.close()
    })
  })
}
