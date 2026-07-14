---
description: Post a chat message into any room as the "System" bot (Jacob's agent), on Jacob's behalf
---

# Post as System into a chat room

Jacob wants a message posted into an LD chat room authored by **System** (not
"Jacob"), so the other people know it's Jacob's agent — but it still lands in the
normal thread so the conversation continues. Members get their usual ping (email/
ntfy), except Jacob himself.

**How it works:** you insert ONE row into `chat_system_outbox` in `shared.db`. A
server cron (`system-outbox-cron.ts`, every ~20s in prod) drains it — posting the
message as the System bot (it doesn't need to be a room member) and firing the
normal member notification, skipping the `skip_user_id` you set (Jacob). No API
route, no auth, no cookie. See `$lib/server/chat/system-outbox.ts`.

## What Jacob gives you
- **Which room** — usually "my DM with Greg", "the Diego/Greg/me room", or a
  channel name.
- **What to say** — the message text.

## Steps

### 1. Pick the DB + `node` runner

| | shared.db path | run node |
|---|---|---|
| **prod** (default) | `/data/shared.db` | `ssh living 'docker exec -i sveltekit_blue node' < /tmp/q.js` |
| **dev** | `site/.data/shared.db` | `node /tmp/q.js` (from repo, better-sqlite3 resolvable) |

> **Dev caveat:** the outbox cron is dormant in dev (`building||dev`), so a dev row
> won't auto-deliver. To test the whole flow in dev, run the outbox processor
> yourself after inserting (or just rely on the vitest suite). In **prod** the cron
> delivers within ~20s.

Always write the script to `/tmp/q.js` and pipe it via stdin — escaping inside
`docker exec` is brutal (see the database skill).

### 2. Resolve the room id + recipients (read-only first)

Run this to find the room and confirm who'll be pinged. Adjust the email filter to
the people Jacob named:

```js
const db = require('better-sqlite3')('/data/shared.db', { readonly: true })
// Rooms Greg is in, with their members — find the one Jacob means:
const rooms = db.prepare(`
  SELECT r.id, r.kind, r.name,
    (SELECT group_concat(u.email, ', ') FROM chat_room_members m JOIN users u ON u.id = m.user_id WHERE m.room_id = r.id) AS members
  FROM chat_rooms r
  WHERE r.id IN (SELECT room_id FROM chat_room_members m JOIN users u ON u.id = m.user_id WHERE u.email = 'livingtongues@gmail.com')
`).all()
console.log(JSON.stringify(rooms, null, 2))
// Jacob's user id (to skip pinging him):
console.log(db.prepare(`SELECT id FROM users WHERE email = 'jwrunner7@gmail.com'`).get())
```

Notes:
- A **DM** room id is `dm:` + the two user ids sorted + joined by `:`
  (`dm_room_id` in chat-db.ts). Group rooms have their own ids/names
  (e.g. `diego-greg-jacob`). Just take the `id` from the query above.
- Greg = `livingtongues@gmail.com`, Diego = `diego@livingtongues.org`,
  Anna = `dictionaries@livingtongues.org`, Jacob = `jwrunner7@gmail.com`.
- **Echo the room + member emails back to Jacob and get his OK before writing** —
  this pings real people.

### 3. Insert the outbox row (writable)

`body_html` renders as trusted HTML in the chat (it's sanitized again on post) —
keep it simple (`<p>…</p>`, escape anything from Jacob's input). `body_text` is the
plain-text mirror used for previews + the ping. `skip_user_id` = Jacob's id so he
isn't pinged for his own agent's message.

```js
const db = require('better-sqlite3')('/data/shared.db')
const { randomUUID } = require('crypto')
const id = randomUUID()
db.prepare(`INSERT INTO chat_system_outbox (id, room_id, body_html, body_text, skip_user_id, created_at)
  VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
  .run(id, ROOM_ID, BODY_HTML, BODY_TEXT, JACOB_USER_ID)
console.log('queued', id)
```

### 4. Confirm delivery
After ~20s in prod, verify it posted + cleared:

```js
const db = require('better-sqlite3')('/data/shared.db', { readonly: true })
console.log(db.prepare('SELECT processed_at, error FROM chat_system_outbox WHERE id = ?').get(ID))
```

`processed_at` set + `error` null → delivered. If `error` is non-null, report it to
Jacob (e.g. "room not found").
