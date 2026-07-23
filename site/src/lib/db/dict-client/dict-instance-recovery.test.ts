import { make_additive_migration_resumable, poisoned_file_recovery_decision } from './dict-instance'

describe(poisoned_file_recovery_decision, () => {
  test('replaces a viewer\'s existing poisoned file (the recoverable case)', () => {
    expect(poisoned_file_recovery_decision({ file_existed: true, has_editor_role: false, already_attempted: false }))
      .toEqual({ replace: true, reason: 'viewer_replace' })
  })

  test('PRESERVES an editor\'s existing file — un-pushed writes cannot be proven absent', () => {
    expect(poisoned_file_recovery_decision({ file_existed: true, has_editor_role: true, already_attempted: false }))
      .toEqual({ replace: false, reason: 'editor_preserve' })
  })

  test('never replaces a freshly-fetched file (failure there is environmental, not a poisoned file)', () => {
    expect(poisoned_file_recovery_decision({ file_existed: false, has_editor_role: false, already_attempted: false }))
      .toEqual({ replace: false, reason: 'not_existing' })
    // an editor with no prior file is likewise not eligible
    expect(poisoned_file_recovery_decision({ file_existed: false, has_editor_role: true, already_attempted: false }))
      .toEqual({ replace: false, reason: 'not_existing' })
  })

  test('refuses a replacement after the page-session permit was claimed by an earlier worker', () => {
    expect(poisoned_file_recovery_decision({ file_existed: true, has_editor_role: false, already_attempted: true }))
      .toEqual({ replace: false, reason: 'already_attempted' })
  })

  test('editor gate takes precedence over the once-per-lifetime bound', () => {
    // even on the first attempt an editor is never eligible
    expect(poisoned_file_recovery_decision({ file_existed: true, has_editor_role: true, already_attempted: true }))
      .toEqual({ replace: false, reason: 'editor_preserve' })
  })
})

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
