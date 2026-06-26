import type Database from 'better-sqlite3'
import BetterSqlite3 from 'better-sqlite3'
import { resolve_page_context } from './resolve-url'

// Minimal in-memory DB so the resolver's dictionary lookup has something to hit.
function make_db(): Database.Database {
  const db = new BetterSqlite3(':memory:')
  db.exec(`CREATE TABLE dictionaries (id TEXT PRIMARY KEY, url TEXT, name TEXT);`)
  db.prepare('INSERT INTO dictionaries VALUES (?,?,?)').run('dict1', 'nuxalk', 'Nuxalk')
  return db
}

describe(resolve_page_context, () => {
  test('resolves a top-level app page', () => {
    expect(resolve_page_context({ url: 'https://livingdictionaries.app/account', db: make_db() }))
      .toBe('their account page')
  })

  test('resolves the home page', () => {
    expect(resolve_page_context({ url: 'https://livingdictionaries.app/', db: make_db() }))
      .toBe('the dictionaries globe (home page)')
  })

  test('resolves a dictionary landing page by slug', () => {
    expect(resolve_page_context({ url: 'https://livingdictionaries.app/nuxalk', db: make_db() }))
      .toBe('the "Nuxalk" dictionary landing page')
  })

  test('resolves a dictionary by id', () => {
    expect(resolve_page_context({ url: 'https://livingdictionaries.app/dict1/entries', db: make_db() }))
      .toBe('the "Nuxalk" dictionary — browsing the entries list')
  })

  test('resolves a dictionary section', () => {
    expect(resolve_page_context({ url: 'https://livingdictionaries.app/nuxalk/settings', db: make_db() }))
      .toBe('the "Nuxalk" dictionary — the dictionary settings page')
  })

  test('resolves a single entry detail page', () => {
    expect(resolve_page_context({ url: 'https://livingdictionaries.app/nuxalk/entry/abc123', db: make_db() }))
      .toBe('the "Nuxalk" dictionary, viewing a specific entry')
  })

  test('falls back gracefully for an unknown dictionary', () => {
    expect(resolve_page_context({ url: 'https://livingdictionaries.app/unknown-dict/grammar', db: make_db() }))
      .toBe('a dictionary (unknown-dict) — the grammar page')
  })

  test('returns null for empty url', () => {
    const db = make_db()
    expect(resolve_page_context({ url: null, db })).toBeNull()
    expect(resolve_page_context({ url: '', db })).toBeNull()
  })
})
