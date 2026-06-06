// vitest stand-in for SvelteKit's `$env/dynamic/public` (aliased in
// vitest.config.ts). Reads the live process env so tests can set
// `process.env.PUBLIC_GOOGLE_OAUTH_CLIENT_ID` etc. before exercising modules
// that read public runtime env (e.g. `auth/google.ts`).
export const env = process.env as Record<string, string | undefined>
