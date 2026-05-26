import process from 'node:process'

/**
 * Vitest stand-in for `$env/dynamic/public`. The real module is provided by
 * SvelteKit at runtime; tests bypass SvelteKit and read from `process.env`.
 *
 * Tests can:
 *   1. `vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_FOO: 'test' } }))`
 *      to hardcode values.
 *   2. Set `process.env.PUBLIC_FOO = 'test'` in `beforeAll` — the proxy
 *      passes through.
 */
export const env: Record<string, string | undefined> = new Proxy({}, {
  get(_target, key: string) {
    return process.env[key]
  },
})
