# Secure dictionary mode (bucket = 'secure')

Enforce a fully locked-down mode for dictionaries with `dictionaries.bucket = 'secure'` (the
value already exists in `DICTIONARY_BUCKETS`; only enforcement is missing). Currently only
**river** (`id='river'`, `public=null`) is secure in prod.

## Decisions (from Jacob, 2026-07-12)

- **Flag**: reuse `dictionaries.bucket === 'secure'` — no new column, no migration. Set manually
  from the back end (/admin/buckets already offers it). No settings-page toggle, no invite-flow
  exemption (roles get granted by admin directly).
- **Who may access**: any **direct `dictionary_roles` grant** (contributor/editor/manager) on the
  dict, OR **site admin level ≥ 3** (Super Admin). Levels 1 (Super Manager) and 2 (Admin) are
  **blocked** — this deliberately breaks the usual `admin_level >= 1` bypass, for secure dicts only.
- **Blocked users**: redirect to `/` exactly like an unknown slug — a secure dict must be
  indistinguishable from a nonexistent one (no existence leak). API endpoints answer the same
  404 `dictionary not found` they give for unknown ids.
- **API keys** (`/api/v1`): keep working unchanged — keys are dict-scoped and minted by manager+,
  inside the trust boundary. Only the human-session path tightens (admin bypass → level 3).
- **Media bytes** (GCS/lh3 public URLs): explicitly out of scope — Jacob is not worried.
- **R2 public snapshot**: never build one for secure dicts, and **delete the existing R2 object**
  (river has one today).
- **Hot path**: zero added queries for normal dicts — every gate keys off data already in hand
  (`dictionary.bucket` on the already-fetched catalog row, `ssr_role` already resolved,
  `admin_level` already on `ssr_user`). Secure-only branches may do extra work.
- Existence-leak to site admins (catalog metadata in `/api/dictionaries?visibility=private|all`,
  admin globe overlay, shared.db admin sync) is **accepted** — admins know it exists; content is
  what's protected.

## Access rule (one helper, one truth)

`site/src/lib/db/server/secure-dictionary.ts` (new):

```ts
is_secure_dictionary(dictionary)        // bucket === 'secure'
can_access_secure_dictionary({ role, admin_level })  // role != null || admin_level >= 3
```

Unit-tested inline (`import.meta.vitest`).

## Gate points

### 1. Page shell — `[dictionaryId]/+layout.server.ts` ✳ the "don't pass go" gate
After `get_dictionary_by_url_or_id` and **before** the canonical-slug 301 (that redirect itself
leaks existence): if secure and `!can_access({ role: ssr_role, admin_level: ssr_user?.admin_level ?? 0 })`
→ `redirect(MOVED_PERMANENTLY, '/')` — byte-identical outcome to the unknown-slug branch.
- `ssr_role` lookup currently only runs when `ssr_user` exists — anonymous → no role → redirect. ✅
- `ssr_user.admin_level` comes from `get_user` → `resolve_admin_level` (allow-list + roles +
  dev cookie), already computed in root `+layout.server.ts`. Zero new queries.
- Covers ALL `/[dictionaryId]/**` pages (entries, entry, texts, export, settings, history…) on
  SSR *and* on client-nav (param change re-runs the server load as a data request).
- Note: an in-tab role revocation isn't re-checked on within-dict navigation — acceptable; server
  endpoints re-verify every request.

### 2. `verify_auth_dict_role` — tighten the admin bypass when secure
Add secure-awareness so all role-gated endpoints inherit the rule in one place:
- Callers pass the resolved dictionary (they all already have it or the id they resolved from);
  signature moves to an options object per coding guidelines:
  `verify_auth_dict_role(event, { dictionary, min_role })` (~10 call sites: catalog, partners,
  roles, roles/[role_id], invites/[invite_id], api-keys ×2, upload, db, changes, history,
  verify-dict-api-access).
- When `is_secure_dictionary(dictionary)`: admin bypass requires `admin_level >= 3` (else fall
  through to the direct-role lookup — a level-1/2 admin **with** a direct grant still passes via
  the grant); and a failed lookup errors 404 `dictionary not found` instead of 403 (no leak).
- Non-secure behavior byte-identical (`admin_level >= 1` bypass unchanged).

### 3. `/api/dictionary/[id]/changes` — close the anonymous-pull hole
`resolve_caller` currently lets anonymous/role-less callers pull deltas. When secure:
- no session, or session with neither a direct role nor admin ≥ 3 → 404 `dictionary not found`.
- direct-role holders + admin-3 sync normally.

### 4. `/api/dictionary/[id]/db` (fresh VPS snapshot) — min role → `'contributor'`
Currently `'editor'`-gated. Two reasons to lower to `'contributor'`:
- On a secure dict there is **no R2 snapshot**, so every allowed member must boot via this
  endpoint — including contributors (who may view per the decision above).
- Pre-existing latent mismatch (see "Contributor rank bug" below): the client already sends
  contributors down this path (`can_edit` includes contributor → `has_editor_role: true` →
  `fetch_from_vps`) where they'd 403.
Secure admin bypass tightens via §2.

### 5. R2 snapshot builder — skip + delete
`sweep_dirty_dictionaries` in `r2-snapshot-builder.ts`:
- Exclude secure dicts from the build query: `AND (bucket IS NULL OR bucket != 'secure')`.
- Cleanup pass each sweep: secure dicts with `snapshot_uploaded_at IS NOT NULL` → R2
  `DeleteObject dictionaries/{id}.db.gz` + `SET snapshot_uploaded_at = NULL`. Self-healing for
  future flips; river's object gets deleted on the first prod sweep after deploy.
- Extend `r2-snapshot-builder.test.ts`.
- Post-deploy verify: `curl -sI https://snapshots.livingdictionaries.app/dictionaries/river.db.gz`
  → 404 (allow ~2 min CDN cache).

### 6. `/api/dictionary/[id]/entry/[entryId]` (anonymous SSR entry reader)
Currently anonymous-reachable. When secure: resolve session → same access rule → else 404
`dictionary not found`. Only adds work on the secure branch (dictionary row already fetched).

### 7. `/api/v1/*` via `verify_dict_api_access`
API-key path untouched. Session path inherits §2 automatically (read stays contributor+,
write stays editor+, admin bypass → 3 when secure).

## Audited — no change needed

- **Listings/SEO**: homepage globe, `/dictionaries`, `sitemap.xml`, homepage export/featured
  entries all filter `public = 1`; river has `public=null`. Enforce-by-convention: secure dicts
  must keep `public != 1` (manual setup; note in `/admin/buckets` copy if trivial).
- **`/og`**: renders purely from query params — no stored-data leak.
- **Search/Orama, export CSV**: client-side from dict.db — gated by data access (§1/§3/§4).
- **History endpoint**: role-gated already; inherits §2.
- **Roles/invites/partners/catalog manage endpoints**: manager-gated; inherit §2.
- **shared.db admin sync**: level-1+ admins see catalog metadata (name, entry_count) — accepted.

## Contributor rank bug (pre-existing, folded in — CONFIRMED by Jacob: "we have no editors. contributors AND managers are can_edit")

Client `+layout.ts`: `can_edit` includes `contributor` → session opens `has_editor_role: true` →
VPS snapshot fetch + `/changes` pushes. Server: `ROLE_RANK` gates both at `'editor'` →
contributors 403 on `/db` (boot would fail) and `is_editor: false` on `/changes` (pushes silently
dropped). Prod: **0 `editor` rows, 317 `contributor`, 1729 `manager`** — contributor IS the
editing tier (invite UI only issues manager/contributor). No 403s in retained logs (stale grants /
contributors not logging in), but it's a live trap. Fix: min role `'contributor'` for `/db` (§4)
and for the `/changes` push path (`resolve_caller`), matching client semantics. History stays
`'editor'`+ by deliberate design.

## Verification

1. `pnpm test` — new inline tests for `secure-dictionary.ts` + `verify_auth_dict_role` secure
   matrix (anon / no-role user / contributor / manager / admin 1 / 2 / 3) + builder skip/delete.
2. `tsc`, `pnpm lint`, `pnpm check`.
3. Dev e2e (dev-auth + puppeteer, port 3041): set a local dict `bucket='secure'` in
   `.data/shared.db`, then:
   - anonymous + logged-in-no-role → `/{dict}` and `/{dict}/entries` land on `/`
   - `dev_admin_level` 2 → redirected; 3 → full dict loads (boot via VPS snapshot path)
   - manager/contributor of the dict → loads + sync works
   - `curl` `/api/dictionary/{id}/changes` (anon) → 404; `/api/dictionary/{id}/db` (anon) → 401,
     contributor → 200; `/api/dictionary/{id}/entry/{entryId}` (anon) → 404
   - non-secure dict spot-check: anonymous browse + R2 viewer boot unchanged
4. Post-deploy: river snapshot URL → 404; river opens for its manager + Jacob (level 3); logs
   clean (check-logs skill).

## Status — ✅ IMPLEMENTED (2026-07-12), not yet committed/deployed

- ✅ `$lib/db/server/secure-dictionary.ts` helper + inline tests
- ✅ `verify_auth_dict_role` → options object `{ dictionary, min_role }`, secure-aware (admin bypass
  ≥3 when secure, 404 for anon/no-grant; member with insufficient rank keeps 403) + full test matrix
  (`verify-dict-role.test.ts`)
- ✅ All ~12 call sites converted; sites that only had `dict_id` now resolve the row via
  `get_dictionary_by_url_or_id` (404 if missing) and write with the canonical `dictionary.id`
- ✅ Layout guard in `[dictionaryId]/+layout.server.ts` — before the canonicalize 301, zero added queries
- ✅ `/changes`: `resolve_caller` min role → `'contributor'` (push fix); secure non-members → 404
- ✅ `/db`: min role → `'contributor'`
- ✅ `/api/upload`: min role → `'contributor'` (was silently blocking contributors' media uploads);
  test updated to assert contributors CAN upload
- ✅ Anonymous surfaces gated when secure: `/api/dictionary/[id]/entry/[entryId]`,
  `/api/dictionaries/[id]/partners` GET
- ✅ `verify_dict_api_access` takes the dictionary row (API keys unchanged, session path inherits)
- ✅ R2 builder: secure dicts excluded from sweep; self-healing DeleteObject + watermark clear for
  secure dicts with a lingering snapshot; `force_rebuild_snapshot` refuses secure; tests added
- ✅ Audited-no-change: sitemap child route already requires `public = 1`; `/og` renders from query
  params only; listings filter `public = 1`
- ✅ Verified: full vitest (1552 passed), tsc, eslint (touched files), svelte-check clean
- ✅ E2E on dev (achi flipped secure): anon + no-role + L1 + L2 → 301 `/` byte-identical to unknown
  slug; L3 + contributor + manager → 200; `/db`+`/changes`+`entry`+`partners` → 404 anon, 200 member;
  contributor PUSH persists to dict.db (previously dropped); local state restored after

### Post-deploy checklist
- [ ] `curl -sI https://snapshots.livingdictionaries.app/dictionaries/river.db.gz` → 404 after the
      first sweep (~30 min interval + 2 min CDN cache)
- [ ] river opens for its manager + a level-3 admin; logs clean (check-logs skill)
