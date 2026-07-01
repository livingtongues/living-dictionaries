# Agents page: copyable agent prompt + read/write key roles

Two changes to the `/[dictionaryId]/agents` page & the `/api/v1` key model.

## 1. Copyable agent prompt (replaces the human "the Living Dictionaries API" link)
- New `$lib/components/settings/AgentPrompt.svelte`: builds a full-width, copyable prompt from
  `page.url.origin` + the dictionary id, with a Copy button. Placeholder `<YOUR_API_KEY>` (key is
  copied separately from the token-reveal — decided: placeholder only, not embedded).
- Not constrained to the prose measure — `pre` is `width:100%` / `pre-wrap` ("don't max-width the
  text there").
- Wired into `agents/+page.svelte`; the old `<a href="/api/v1">the Living Dictionaries API</a>` link
  is removed. Muted history note reworded "the manager whose key it used" → "the person whose key it
  used".

## 2. Read / read & write key roles (drop manager/editor/contributor for keys)
Decision (Jacob): use genuine `read`/`write` role values for API keys — the old dict-role names
"don't work the same way" (the v1 API can't change settings, so `manager` == `editor` in practice).
No backfill needed (the one dictionary with a key was deleted).

- `ApiKeyRole = 'read' | 'write'` (was `'manager'|'editor'|'contributor'`). Default `write`.
- Gate: `verify-dict-api-access.ts` maps `read→1`, `write→2` (`API_KEY_RANK`) vs the endpoint
  `min_role` ranks (contributor 1 / editor 2 / manager 3) — read passes reads, write passes writes,
  read blocked from writes (403 "read-only"). The session path keeps the contributor/editor/manager
  vocab (dictionary_roles is unchanged).
- UI (`ApiKeys.svelte`): "Access" select → **Read & write** (default) / **Read only**; badge shows
  "Read & write" / "Read only"; hint/role-hint reworded; removed the duplicate `/api/v1` link.
- Docs: `openapi.ts` Auth blurb + `/api/v1/+server.ts` landing ("minted on the Agents page",
  read/write framing). Drizzle `shared.ts` enum + `20260629_api_keys.sql` default/comment → read/write
  (cosmetic on prod: no CHECK, app always supplies role, table empty).

## Touch points
- `$lib/api-keys/api-key.ts` — type, default, header comment
- `$lib/auth/verify-dict-api-access.ts` — API_KEY_RANK mapping, DictApiAccess.role type, 403 msg
- `routes/api/dictionaries/[id]/api-keys/+server.ts` — VALID_ROLES, default
- `$lib/components/settings/ApiKeys.svelte` — options, default, badge label, copy
- `$lib/components/settings/AgentPrompt.svelte` — NEW
- `routes/[dictionaryId]/agents/+page.svelte` — render prompt, reword, drop link
- `$lib/api/v1/openapi.ts`, `routes/api/v1/+server.ts` — docs
- `$lib/db/schemas/shared.ts`, `shared-migrations/20260629_api_keys.sql` — enum/default
- tests: `api-key.test.ts`, `entries/server.test.ts` (+ read-key 403)
- `.knowledge/api/v1-write-api.md`

## Status
- [x] implement (all touch points above)
- [x] pnpm test (api-key lib + api-keys endpoint + full v1 suite: green) / check (0 errors) / lint (clean)
- [x] svelte-look visual verify: `ApiKeys` shows new "Access → Read & write" select + reworded
  role-hint; new `AgentPrompt` renders full-width copyable prompt with `<YOUR_API_KEY>` placeholder.
- Note: `+page.svelte` svelte-look story pre-existingly errors (needs `data.dictionary` mock — not
  wired); components verified individually instead.
- Note: `20260629_api_keys.sql` DEFAULT edited `'manager'`→`'write'` is cosmetic on any already-migrated
  DB (no CHECK, app always supplies role, table empty) — no new migration needed.
