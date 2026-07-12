# Secure dictionary mode — decisions not readable from the code

Implementation lives in `$lib/db/server/secure-dictionary.ts` + `verify_auth_dict_role`
(`bucket = 'secure'`); this page records only the surrounding decisions (2026-07-12, with Jacob).

- **Who it's for**: rare, manually-configured dictionaries. In prod there is exactly one —
  **river** (`id='river'`). Setup is back-end/manual: super admin sets the bucket on
  /admin/buckets and grants roles directly (`dictionary_roles` insert or /roles endpoint).
  There is deliberately NO invite-flow exemption and NO settings-page toggle.
- **Admin levels 1 (Super Manager) and 2 (Admin) are intentionally blocked** — this is the one
  place the site-wide "level ≥ 1 bypasses per-dict roles" rule does not apply. Don't "fix" it.
- **No-existence-leak is a hard requirement**: blocked pages get the byte-identical unknown-slug
  `301 /`; blocked API calls get the same `404 dictionary not found` as an unknown id (including
  converting the would-be 401 for anonymous callers). A *member* with insufficient rank keeps the
  normal 403 — they already know the dict exists.
- **Accepted leaks** (Jacob signed off): media bytes on public GCS/lh3 URLs remain fetchable by
  anyone holding the URL (signed-URL work explicitly out of scope, "not worried at all");
  catalog metadata (name, entry_count…) stays visible to level-1+ admins via the admin sync /
  `?visibility=private` listing / admin globe overlay.
- **API keys keep working** on secure dicts — they're dict-scoped and minted by manager+, inside
  the trust boundary. Only the human-session path of `/api/v1` tightens.
- **Hot-path constraint**: the guard must add zero queries for normal dictionaries — every gate
  keys off data already in hand (bucket on the fetched catalog row, `ssr_role`,
  `ssr_user.admin_level`). Keep it that way when touching these loads.
- **Secure dicts must be kept `public != 1` by convention** (manual setup step) — listings,
  sitemap, homepage stats all filter on `public = 1`, not on the bucket.

## Contributor = the editing tier (fixed in the same change)

Prod `dictionary_roles` has **zero `'editor'` rows** (317 contributors, 1729 managers; the invite
UI only ever issues manager/contributor). The client's `can_edit` includes contributors, but the
server sync gates (`/db` snapshot, `/changes` push, `/api/upload`) required rank `'editor'` — so
contributor pushes were silently dropped and their VPS snapshot boot would 403. All three gates
now use `min_role: 'contributor'`. `history` stays `'editor'`+ by design (in practice manager+).
Secure-dict members always boot via the authed `/db` path (no public R2 snapshot exists for them).
