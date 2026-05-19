# Knowledge Base

## Categories

### [architecture/](architecture/index.md)
Core app architecture: PGlite sync, admin data flow, schema design.

### [decisions/](decisions/index.md)
Architectural decisions: globe implementation, Svelte 5 migration notes.

## Cross-repo notes

- UnoCSS preset choice: we use **`presetWind3`** across LD-site + house + tutor because Wind4 + svelte-scoped + `@apply` crashes — see `~/code/tutor/.knowledge/tooling/unocss-svelte-scoped-wind4-apply-bug.md`.
