import Database from 'better-sqlite3'
import { seed_translations_if_empty } from './i18n-db'

describe(seed_translations_if_empty, () => {
  test('seeds both hyphenated Chinese catalogs while ignoring an unregistered catalog', async () => {
    const db = new Database(':memory:')
    db.exec(`
      CREATE TABLE i18n_keys (id TEXT PRIMARY KEY);
      CREATE TABLE i18n_translations (
        id TEXT PRIMARY KEY,
        key_id TEXT NOT NULL,
        locale TEXT NOT NULL,
        value TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (key_id, locale)
      );
      INSERT INTO i18n_keys (id) VALUES ('page.title');
    `)

    const seeded = await seed_translations_if_empty({
      db,
      catalog_modules: {
        '/src/lib/i18n/locales/zh-CN.json': () => Promise.resolve({ default: { page: { title: '简体' } } }),
        '/src/lib/i18n/locales/gl/zh-TW.json': () => Promise.resolve({ default: { page: { title: '繁體' } } }),
        '/src/lib/i18n/locales/not-registered.json': () => Promise.resolve({ default: { page: { title: 'wrong' } } }),
      },
    })

    expect(seeded).toBeTruthy()
    expect(db.prepare('SELECT locale, value FROM i18n_translations ORDER BY locale').all()).toEqual([
      { locale: 'zh-CN', value: '简体' },
      { locale: 'zh-TW', value: '繁體' },
    ])
    db.close()
  })
})
