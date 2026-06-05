---
name: learn-about-app
description: Learn about the Living Dictionaries app architecture, data structures, and key features
---

## When to use me
To quickly understand the Living Dictionaries domain (what a dictionary/entry/sense is) and how
**this repo** is currently built. For the migration plan and milestone status, read
`.issues/cross-project-orchestration.md`. For the *target* architecture we're migrating toward, read the
example repo's `.knowledge/architecture/*` (don't assume it exists here yet).

## What the app is
A platform for documenting endangered/minority languages. Communities build a **dictionary**
of **entries** (words/phrases); each entry has **senses**, example **sentences**, and rich
media (audio, photos, video) tied to **speakers**, plus **dialects** and **tags**. Public
read-only browsing for anyone; managers/editors/contributors edit a given dictionary. There's
also an **admin** surface (super-admins) and marketing/account routes.

## Domain data model (stable regardless of backend)
Text fields that vary by language are "MultiString" — a map of `{ <locale>: "…" }`.
- **Dictionary** — catalog metadata: name, url slug, public/private, language/gloss languages,
  coordinates / where-spoken, settings, entry_count, partners.
- **Entry** — `lexeme` (MultiString), `phonetic`, `notes`, `morphology`, `interlinearization`.
- **Sense** (child of entry) — glosses (MultiString per gloss-language), parts of speech,
  semantic domains, definition.
- **Sentence** — example text + translation (MultiString); linked to senses; can belong to a text.
- **Speaker** — name, decade of birth, gender, regional metadata.
- **Audio / Photo / Video** — media rows with a storage path + serving url; linked to entries/
  senses/sentences and (for audio) to speakers.
- **Dialect**, **Tag** — labels attached to entries.
- **User**, **dictionary role** (manager/editor/contributor), **invite**, **partner**.

Authoritative current shapes live in `packages/types` and `site/src/lib/supabase/*`. (These are
Supabase-generated today; they'll evolve as the backend migrates.)

## Current architecture (today, mid-migration)
- **SvelteKit + Svelte 4 + UnoCSS**, `@sveltejs/adapter-node`.
- **Supabase** for data + auth — `site/src/lib/supabase/` (`index.ts` client, `auth.ts`,
  `operations.ts` writes, `cached-data.ts` / `cached-query-data.ts` reads), surfaced through
  `dbOperations.ts`. Routes load via `+layout.ts`/`+page.ts`.
  **⚠ This whole layer is being stubbed out in M1** (hand-wave auth + tiny dummy data in the
  same shapes) so the app boots with zero Supabase. Don't build new features on Supabase.
- **Search:** Orama (client-side full-text) — `site/src/lib/search/`.
- **Maps:** Mapbox GL.
- **Export:** `site/src/lib/export/`.

## Routes (high level)
`/` (Mapbox globe of dictionaries) · `/about` · `/tutorials` · `/dictionaries` · `/account` ·
`/create-dictionary` · `/[dictionaryId]/*` (entries list, entry detail, settings, about,
contributors, grammar, history, export, import, invite) · `/admin/*` · `/og` (share image) ·
`/terms` · `/setlocale`.

## Where to look
| Need | Where |
|---|---|
| Migration plan + status | `.issues/cross-project-orchestration.md` |
| Current domain types | `packages/types`, `site/src/lib/supabase/*` |
| Target SQLite/sync/VPS architecture | example repo `.knowledge/architecture/*` (reference) |
| Build/deploy gotchas | `.knowledge/migration/build-and-deploy-gotchas.md` |
| Live parity (the running prod site) | https://livingdictionaries.app (this codebase) |
