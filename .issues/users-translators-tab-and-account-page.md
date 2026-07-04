# Users Translators tab, unsub label fix, and /account polish

## Tasks

### 1. Translators filter tab on /admin/users ✅ plan
- `translator_languages` is server-only (not synced to admin clients). Reuse the
  existing admin-only `GET /api/translate/summary` (`api_translate_summary()`),
  which returns `{ translators: TranslatorInfo[] }`.
- Fetch roster onMount → `Set<user_id>`; drives a new `translators` filter pill
  (count = size) and the row filter. Explicit assignees only (admins excluded —
  they have their own tab and no rows).

### 2. Unsub column label
- `+page.svelte` unsub button: subscribed state currently reads `subscribe`;
  change to `unsubscribe` (action verb). Unsubscribed state stays `unsubscribed`.

### 3. LD /account polish (align to house)
- Extend `POST /api/auth/update-profile` to accept `unsubscribed_from_emails: boolean`
  (self-serve; mirrors admin unsubscribe endpoint). Update `_call.ts` body type + test.
- Redesign `/account/+page.svelte`: `--surface` card, avatar, name (EditString),
  email, Admin Panel link for admins, newsletter subscribe/unsubscribe toggle,
  logout. Keep a balance of inline styles + scoped classes per svelte-ui skill.
- Add EN i18n keys as needed (EN files only).
- Add `_page.stories.ts` for svelte-look verification (light + dark).

### 4. House /account
- Screenshot via svelte-look; only fix genuine svelte-ui oddities. Otherwise leave.

## Verify
- `pnpm test`, `tsc`, svelte-look screenshots (light + dark) for both account pages
  and the users page tab.

## Status: ✅ DONE
- ✅ Translators filter pill added to /admin/users (reuses `api_translate_summary()`;
  explicit assignees only). Filters + counts.
- ✅ Unsub column label: subscribed state now reads `unsubscribe` (was `subscribe`).
- ✅ `update-profile` endpoint accepts `unsubscribed_from_emails` (+ tests, 10 passing).
- ✅ LD /account redesigned: surface card, avatar, name, email, Admin Panel link,
  newsletter toggle, logout. EN i18n keys added. `_page.stories.ts` added.
- ✅ House /account reviewed via svelte-look — already skill-aligned, left as-is.
- ✅ tsc clean, eslint clean, `pnpm check` 0 errors.

Note: the story's translators pill shows count 0 because the onMount fetch to
`/api/translate/summary` isn't reachable in the SSR story harness — expected;
real app populates it.
