# Admin-level API key for /api/v1

Jacob (2026-07-24, during the Enxet import): "What I really need is an
admin-level agent API key that can behave on our behalf — Diego and I — without
having to mint a special API key for each dictionary."

## Current state

- `shared.db.api_keys` rows are scoped to ONE `dictionary_id` (NOT NULL FK),
  role read/write. Minted by managers via `/api/dictionaries/{id}/api-keys`,
  verified in `$lib/api-keys/api-key.ts` `verify_api_key`, gated per-request in
  `$lib/auth/verify-dict-api-access.ts` → `load_v1_dictionary_context`.
- Writes are attributed to `created_by_user_id` + `api_key_id` in change history.

## Design sketch (to interview Jacob on before building)

- Likely shape: allow `dictionary_id = NULL` (or a `scope = 'admin'` column) —
  an admin key passes `verify_dict_api_access` for ANY dictionary, with the
  same role semantics. Must respect `bucket='secure'` rules
  (`$lib/db/server/secure-dictionary.ts`): probably only pass when
  `created_by_user_id` is a level-3 admin who'd pass anyway.
- Minting surface: /admin UI (admins only) vs. a bin script. Revocation +
  display parity with per-dict keys (settings Agents panel must NOT list other
  dictionaries' admin keys).
- Attribution: keep `created_by_user_id` = the admin (Jacob/Diego) so history
  reads "on behalf of".
- Also update `/api/v1` docs/openapi + guides if agents will be handed such
  keys.

## Context from the first import

For Enxet we minted a normal per-dict key by direct INSERT (see
`.knowledge/domain/import-workflow.md`); the admin key removes that per-dict
minting step.
