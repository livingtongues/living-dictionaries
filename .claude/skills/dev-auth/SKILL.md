---
name: dev-auth
description: Log in as any user — site admin, super manager, dictionary manager/editor/contributor, or plain visitor — in dev/e2e browser testing without a real inbox or hand-minted tokens. Read before any puppeteer/curl session that needs an authenticated LD user.
---

# dev-auth — become anyone in two fetches

LD auth is Email-OTP → httpOnly `session` cookie (30d JWT). In dev (`vite dev`, port **3041**)
`send-code` returns the OTP inline, so you can log in as **any email** — no inbox, no jose, no UI.

## The recipe

```js
// Inside the page (puppeteer `page.evaluate`) so the cookie lands in the browser jar,
// or with `curl -c jar.txt` for API-only work.
const email = 'whoever@you-want.com'
const { code } = await (await fetch('/api/auth/email/send-code', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email }),
})).json()
await fetch('/api/auth/email/verify', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, code }),
}) // sets the httpOnly `session` cookie
// then page.goto(...) again so the server load re-resolves the user for SSR
```

curl equivalent:

```bash
code=$(curl -s -X POST localhost:3041/api/auth/email/send-code -H 'content-type: application/json' -d '{"email":"agent@test.com"}' | jq -r .code)
curl -s -c /tmp/jar.txt -X POST localhost:3041/api/auth/email/verify -H 'content-type: application/json' -d "{\"email\":\"agent@test.com\",\"code\":\"$code\"}"
curl -s -b /tmp/jar.txt localhost:3041/api/auth/me
```

## Picking a permission tier

Two independent axes: the **site admin level 0-3** and **per-dictionary roles**.

### Site admin level — use the dev override cookie (cleanest)

Dev-only `POST /api/auth/dev-admin-level` sets a `dev_admin_level` cookie that
`resolve_admin_level` honors only in dev (404s in prod). Log in as ANY email first, then:

```js
await fetch('/api/auth/dev-admin-level', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ level: 3 }), // 3 Super Admin · 2 Admin · 1 Super Manager · 0/null clears
})
```

Level ≥ 1 also acts as `role: 'admin'` on EVERY dictionary (bypasses `dictionary_roles`), so
`level: 1` is the quick "manager of everything" persona. Alternatively log in as a real allow-list
email (`$lib/admins.ts`): `jwrunner7@gmail.com` / `diego@livingtongues.org` = L3.

### A specific dictionary role (manager / contributor)

To act as a normal user with a scoped role, log in as their email — or mint a fresh user and grant
the role in `shared.db` (the `dictionary_roles` table lives there):

```bash
sqlite3 site/.data/shared.db "INSERT INTO dictionary_roles (dictionary_id, user_id, role, created_at)
  VALUES ('some-dict-id', (SELECT id FROM users WHERE email = 'agent@test.com'), 'manager', strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
```

Roles are checked live per request (`verify_auth_dict_role`) — no re-login needed after the insert.

## Notes & gotchas

- Auth is cookie-first; `Authorization: Bearer <JWT>` fallback exists for script callers
  (`$lib/auth/verify.ts`).
- OTP verify allows 5 failed attempts / 15 min per email; send-code isn't rate-limited while the
  code is exposed inline (dev / `E2E_EXPOSE_OTP=true`).
- Testing a **prod-mode build** (`pnpm build && node build`): set `E2E_EXPOSE_OTP=true` to keep the
  inline-code flow (the `dev_admin_level` cookie does NOT work there — use allow-list emails).
  Never set it on the real VPS.
- Dictionary pages are local-first (per-dictionary OPFS leader worker syncing `/changes`) — give
  the first load of a dictionary a moment before asserting on entry data.

## Getting data

A fresh checkout has empty `site/.data/` dictionaries. Read the **database** skill
(`.claude/skills/database/SKILL.md`) for where local shared/dictionary DBs live, seeding, and how
to query or pull from the production VPS when you need real content.
