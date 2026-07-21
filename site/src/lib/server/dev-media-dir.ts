import { existsSync, unlinkSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import process from 'node:process'

/**
 * Root of the DEV-only local media store (`<DATA_DIR>/dev-media`). Shared by the
 * `api/dev-media/[...path]` route (GET/PUT) and the server-side media-storage
 * helper (v1 media uploads) so both agree on where dev bytes live. Never used in
 * prod (guarded by `import.meta.env.DEV` at each call site).
 */
export function dev_media_dir(): string {
  return join(process.env.DATA_DIR || '.data', 'dev-media')
}

/** Idempotently remove one object from the local DEV-only media store. */
export function delete_dev_media({ key }: { key: string }): boolean {
  const root = resolve(dev_media_dir())
  const full = resolve(root, key)
  if (!full.startsWith(`${root}${sep}`))
    throw new Error('Invalid dev-media key')
  if (!existsSync(full))
    return false
  unlinkSync(full)
  return true
}

if (import.meta.vitest) {
  test('delete_dev_media removes bytes and is idempotent', async () => {
    const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const test_data_dir = mkdtempSync(join(tmpdir(), 'ld-dev-media-'))
    const previous_data_dir = process.env.DATA_DIR
    process.env.DATA_DIR = test_data_dir
    try {
      const key = 'import/demo/file-1'
      const full = join(dev_media_dir(), key)
      mkdirSync(resolve(full, '..'), { recursive: true })
      writeFileSync(full, 'bytes')
      expect(delete_dev_media({ key })).toBe(true)
      expect(existsSync(full)).toBe(false)
      expect(delete_dev_media({ key })).toBe(false)
      expect(() => delete_dev_media({ key: '../outside' })).toThrow('Invalid dev-media key')
    } finally {
      if (previous_data_dir === undefined)
        delete process.env.DATA_DIR
      else
        process.env.DATA_DIR = previous_data_dir
      rmSync(test_data_dir, { recursive: true, force: true })
    }
  })
}
