import process from 'node:process'

/**
 * Vitest stand-in for `$env/dynamic/private`. The real module is provided by
 * SvelteKit at runtime; tests don't have a SvelteKit dev server, so we expose
 * a plain proxy backed by `process.env` for any `env.FOO` reads.
 *
 * Tests can:
 *   1. `vi.mock('$env/dynamic/private', () => ({ env: { FOO: 'test' } }))` to
 *      hardcode values (vi.mock takes precedence over this stand-in).
 *   2. Set `process.env.FOO = 'test'` directly in `beforeAll` — the proxy
 *      passes through.
 */
export const env: Record<string, string | undefined> = new Proxy({}, {
  get(_target, key: string) {
    return process.env[key]
  },
})
