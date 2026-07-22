import { make_additive_migration_resumable } from './dict-instance'

describe(make_additive_migration_resumable, () => {
  test('repairs a partially applied additive migration in place', async () => {
    const existing = new Map([
      ['sentences', [{ name: 'id', type: 'TEXT', notnull: 0 }, { name: 'discourse_role', type: 'TEXT', notnull: 0 }]],
      ['sources', [{ name: 'id', type: 'TEXT', notnull: 0 }]],
    ])
    const connection = {
      query: <T>(sql: string) => {
        const table = /table_info\((\w+)\)/.exec(sql)?.[1] ?? ''
        return Promise.resolve((existing.get(table) ?? []) as T[])
      },
    }
    const sql = `
      CREATE TABLE IF NOT EXISTS grammar_sections (id TEXT PRIMARY KEY);
      ALTER TABLE sentences ADD COLUMN discourse_role TEXT;
      ALTER TABLE sentences ADD COLUMN example_label TEXT;
      ALTER TABLE sources ADD COLUMN orthography TEXT;
      CREATE INDEX IF NOT EXISTS idx_grammar_sections ON grammar_sections(id);
    `

    const repaired = await make_additive_migration_resumable({ connection, sql })
    expect(repaired).not.toContain('ADD COLUMN discourse_role')
    expect(repaired).toContain('ALTER TABLE sentences ADD COLUMN example_label TEXT;')
    expect(repaired).toContain('ALTER TABLE sources ADD COLUMN orthography TEXT;')
    expect(repaired).toContain('CREATE TABLE IF NOT EXISTS grammar_sections')
    expect(repaired).toContain('CREATE INDEX IF NOT EXISTS idx_grammar_sections')
  })

  test('refuses to bless an existing column whose postcondition does not match', async () => {
    const connection = {
      query: <T>() => Promise.resolve([{ name: 'discourse_role', type: 'INTEGER', notnull: 0 }] as T[]),
    }
    await expect(make_additive_migration_resumable({
      connection,
      sql: 'ALTER TABLE sentences ADD COLUMN discourse_role TEXT;',
    })).rejects.toThrow('does not match the declared additive column')
  })
})
