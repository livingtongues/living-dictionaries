# Promote Cailie to level-2 admin + admin-nav tidy

Requested by Jacob (2026-07-15).

## Code changes — ✅ DONE (tests + svelte-check[0 errors] + lint green)
- ✅ `admins.ts`: added Cailie Keating (`ck1105@georgetown.edu`) to `ADMINS` at
  **level 2** — `ntfy_topic: living_pings_cailie_3ede043330d4`,
  `ld_address: cailie@livingdictionaries.app`. (Admin allow-list is hardcoded by
  design — a DB write can't escalate to level ≥ 2.)
- ✅ `admin/+layout.svelte`: removed the **API** + **Triage** header nav links
  (and their now-unused `IconMdiApi` / `IconMdiRobotOutline` imports). Both routes
  stay at admin level 2 (reachable via their dashboard cards, not the header).
- ✅ `admin/+page.svelte`: added a **Triage examples** dashboard card
  (`IconMdiSortVariant`, warning accent). Agent API card keeps the robot/agent logo.
- ✅ `admin/triage-examples/+page.svelte`: swapped its own header robot icon →
  `IconMdiSortVariant`, so the **agent/robot logo now lives only with the API**.

## Prod data op — ⏳ RUN AFTER DEPLOY
Cailie's prod `users.roles` is currently `["super_manager"]` (effective level 1).
Once the new code deploys she becomes a hardcoded level-2 admin, making the
super_manager role redundant. Remove it AFTER deploy (removing it before would
drop her to level 0 in the window before the deploy lands):

```
ssh living 'docker exec -i sveltekit_blue node' <<'EOF'
const db = require('better-sqlite3')('/data/shared.db')
const now = new Date().toISOString()
const EMAIL = 'ck1105@georgetown.edu'
const row = db.prepare('SELECT roles FROM users WHERE email = ?').get(EMAIL)
const roles = JSON.parse(row.roles || '[]').filter(r => r !== 'super_manager')
db.prepare('UPDATE users SET roles = ?, updated_at = ? WHERE email = ?').run(JSON.stringify(roles), now, EMAIL)
console.log(JSON.stringify(db.prepare('SELECT email, roles, chat_access FROM users WHERE email = ?').get(EMAIL)))
EOF
```

Note: her `chat_access = 1` (granted earlier) is now also redundant — a level-2
admin passes the chat gate anyway — but harmless; leaving it.

## Open confirmations (chose sensible defaults, flag for Jacob)
- `ld_address = cailie@livingdictionaries.app` (follows the jacob@/diego@/greg@ pattern;
  CF catch-all routes any `*@livingdictionaries.app` so no extra setup needed).
- `ntfy_topic` is random-suffixed per the admins.ts guidance; she subscribes on her phone.
- Display name `Cailie Keating`, `notify` on (absent = on duty).
