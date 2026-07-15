# Block conlang/glossary dictionaries from the agent API + auto-bucket new conlangs

## Goal
The `/api/v1` agent API is for communities documenting endangered/under-represented
languages. Conlangs and glossaries should NOT be able to use it. Per Jacob's decisions:
we block **minting new API keys** (no guard needed inside the v1 API itself — no key = no
access), show a refusal on the Agents page, and auto-bucket a dictionary as `conlang` at
creation when the creator checks the conlang box.

## Decisions (from interview)
- **Q1/Q2:** Guard **minting only** — the POST mint endpoint + the Agents-page UI. No guard
  in `verify_dict_api_access` / v1 routes. Humans use the web UI, not v1 endpoints.
- **Q3:** Creation sends an explicit `conlang: boolean`; server sets `bucket='conlang'` when true.
- **Q4:** Refusal copy: "The Living Dictionaries API is available only to communities
  documenting endangered and under-represented languages. It isn't available for constructed
  languages or glossaries."
- **Q5:** No backfill — 472 conlang + 165 glossary dicts already bucketed; block is bucket-based
  (respects the 2 admin overrides to `unlisted`).

## Findings
- Choke point for keys: `POST /api/dictionaries/[id]/api-keys/+server.ts` (mint). GET (list) left as-is.
- `api_keys` is **server-only** in shared.db (no `dirty` column → doesn't sync). Revoke = plain
  UPDATE on VPS.
- Agents page (`[dictionaryId]/agents/+page.svelte`) has the full catalog row at
  `data.dictionary` (incl. `bucket`) via `+layout.server.ts`.
- Create endpoint never sets `bucket`. Form has a `conlang` boolean in state but only sends
  `con_language_description`. `pruneObject` strips `conlang: false`, leaving `bucket` null — fine.

## Tasks
- [x] Revoke rhenic's "Reader" key on prod (`741020b4-…`, was the only active unused conlang key).
- [x] `constants.ts`: `API_UNAVAILABLE_BUCKETS` + `API_UNAVAILABLE_MESSAGE` + `is_api_unavailable_bucket()`.
- [x] Guard mint POST → 403 + message when `bucket` is conlang/glossary.
- [x] Agents page → show refusal instead of AgentPrompt/ApiKeys when bucket is conlang/glossary.
- [x] Create form sends `conlang: boolean`; create `+server.ts` sets `bucket='conlang'` when true.
- [x] Tests: mint refusal (2) + create auto-bucket (2). Story flavor `ApiUnavailableConlang`.
- [x] Tests green, tsc clean on touched files, eslint clean, refusal screenshotted (light+dark).
