/**
 * Vitest stand-in for `$app/environment`. The real module is provided by
 * SvelteKit at runtime; tests bypass SvelteKit entirely.
 *
 * `dev = true` matches what production code paths see in `pnpm dev` (and is
 * the safer default for tests — `secure: !dev` in cookie options resolves to
 * `false`, which lets tests synthesize plain `http://localhost` requests).
 *
 * Override per-suite with:
 *   vi.mock('$app/environment', () => ({ dev: false, browser: false, building: false }))
 */
export const dev = true
export const browser = false
export const building = false
export const version = 'test'
