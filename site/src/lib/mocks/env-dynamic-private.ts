// vitest stand-in for SvelteKit's `$env/dynamic/private` (aliased in
// vitest.config.ts). Reads the live process env so tests can set
// `process.env.JWT_SECRET` etc. before exercising server modules.
export const env = process.env as Record<string, string | undefined>
