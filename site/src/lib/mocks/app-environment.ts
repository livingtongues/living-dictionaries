// vitest stand-in for SvelteKit's `$app/environment` (aliased in vitest.config.ts).
// Server modules pulled into unit tests (e.g. resolve-admin-level) import `dev`.
export const dev = true
export const browser = false
export const building = false
export const version = 'test'
