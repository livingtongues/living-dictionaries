// vitest stand-in for SvelteKit's `$env/static/private` (aliased in
// vitest.config.ts). Exposes the names server modules destructure at import
// time (e.g. the SES sender's AWS keys) so importing those modules in tests
// doesn't throw. Values are empty — tests that exercise the external call mock
// the helper itself.
export const AWS_SES_ACCESS_KEY_ID = ''
export const AWS_SES_SECRET_ACCESS_KEY = ''
export const AWS_SES_REGION = ''
export const JWT_SECRET = ''
