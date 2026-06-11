# Load-architecture fixes (F1, F7, F2)

Implementation of the APPROVED quick-wins from the audit
(`.issues/audit-load-architecture.md`). **F5 and Q1 (catalog/contributors caching)
were deliberately NOT taken** — those server pings fire only on infrequent,
genuinely-new-data navigations (dict→dict, opening the contributors tab) and
guarantee freshness for manager/admin edits. The hot path (entry→entry,
within-dict tab nav) is already ping-free.

## F1 — about/grammar over-invalidation ✅
Swap `invalidateAll()` → `invalidate(DICTIONARY_UPDATED_LOAD_TRIGGER)` in:
- `[dictionaryId]/about/+page.ts`
- `[dictionaryId]/grammar/+page.ts`

Refresh still works via the await-parent → server-parent rerun rule (same path
`settings` already uses through the layout's `update_dictionary`). Eliminates the
root re-run + the 2 redundant `/api/dictionaries` + `/api/me/dictionaries`
client refetches on every long-form catalog edit.

## F7 — `_call` wrapper for the dictionaries list ✅
- Add optional `{ fetch }` to `get_request` (`$lib/utils/requests.ts`) so loads can
  pass their injected fetch and KEEP the SSR direct-handler + HTML-inlining
  optimization. Defaults to global `fetch` (existing callers unaffected).
- Add `DictionariesResponseBody` interface to `api/dictionaries/+server.ts`.
- New `api/dictionaries/_call.ts` → `api_dictionaries_list(visibility, { fetch? })`.
- Route through it: `routes/+page.ts` (home, ×2 closures), `globe/+page.ts`
  (awaited on SSR — MUST pass `{ fetch }`), `lib/dictionaries.ts`
  `create_dictionaries_store` (client-only, global fetch fine).
- OUT OF SCOPE: `create_my_dictionaries_store` hits `/api/me/dictionaries` (a
  different endpoint) — left as raw fetch for now.

## F2 — make the catalog-refresh coupling explicit ✅
Comment at `[dictionaryId]/+layout.ts` `depends(DICTIONARY_UPDATED_LOAD_TRIGGER)`
(+ a one-liner in `+layout.server.ts`) documenting that catalog edits refresh
because the universal child's `await parent()` re-runs the server parent — so
nobody removes the `await parent()` and silently breaks refresh.

## Verify
`pnpm --filter site check` (tsc/svelte-check), `pnpm --filter site lint`,
`pnpm --filter site test`. Spot-check: edit a dict `about`, confirm it refreshes
without a full reload; confirm home/globe still SSR the dictionary list.
</content>
