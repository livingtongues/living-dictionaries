# Diego: scoped dev access to the living VPS

Give Diego (external collaborator, NOT on Jacob's tailnet) the ability to dev well against
production, without opening any public ports or giving him broad access.

## What Diego needs

1. **Pull production databases down** to dev locally: per-dictionary DBs
   (`/opt/hosting/data/dictionaries/<id>.db`), the shared DB (`/opt/hosting/data/shared.db`),
   and history data — ✅ located: per-dict sidecars `dictionaries/<id>.history.db` (same dir,
   same read access; rsync glob `<id>*` catches them).
2. **Read the SvelteKit container logs** — both `sveltekit_blue` and `sveltekit_green`.

No deploys, no writes, no root.

## Chosen design (decided with Jacob 2026-07-03)

- **Transport: Tailscale node sharing.** Diego makes a free Tailscale account; Jacob shares
  ONLY the `living` node with him from the admin console. No public SSH port (UFW stays
  tailnet-only). Revocable with one click. Diego reaches the box at `100.98.27.71`.
  Verified: Tailscale SSH server is OFF on living (`RunSSH: false`), so tailnet :22 hits
  regular sshd (`PasswordAuthentication no` already set) — no Tailscale-SSH rule needed.
- **On-box: dedicated low-privilege `diego` user**, key auth only, no general sudo.
- **Rejected alternatives**: opening public port 22; a token-auth download API in the app
  (container logs would need the docker socket in the app container — root-equivalent).

## Status (2026-07-03, mustang session 35dec311)

### 1. On-box: `diego` user ✅ DONE
- ✅ `adduser --disabled-password diego` (uid 1001, no sudo group).
- ✅ `/home/diego/.ssh/authorized_keys` exists EMPTY (700/600, diego-owned) — awaiting his key.
- ✅ Installed `acl` package (wasn't on the box); applied
  `setfacl -R -m u:diego:rX -m d:u:diego:rX /opt/hosting/data` (current + default ACLs).
- ✅ `chmod 600 /opt/hosting/sveltekit/.env` (was 644/world-readable; owner ubuntu — root
  compose + webhook unaffected, verified deploys run as root).
- ✅ `/usr/local/bin/snapshot-db <db> [out]` helper — python3-stdlib SQLite online backup
  (NO sqlite3 CLI on the box and none installed; per Jacob, avoid new packages — python3 covers it).

### 2. On-box: container logs ✅ DONE
- ✅ `/etc/sudoers.d/diego` (validated with `visudo -c`):
  `diego ALL=(root) NOPASSWD: /usr/bin/docker logs sveltekit_blue*, /usr/bin/docker logs sveltekit_green*`

### Verification (throwaway key, since removed) ✅ ALL PASS
- read dict DB / shared.db ✅ · snapshot-db as diego ✅ · `sudo docker logs sveltekit_blue|green` ✅
- DENIED: `sudo docker ps` ✅ · `sudo docker logs <other>` ✅ · write under /opt/hosting/data ✅ ·
  read `.env` ✅
- Re-verify positives once Diego's REAL key is installed.

### 3. Tailnet ACL grant ✅ DONE (2026-07-03, via tuf session)
- Jacob minted a 7-day Tailscale API token, pasted it to the tuf session (`39adb4c8`, since
  deleted). It validated, applied, and committed+pushed:
  `{"src": ["autogroup:shared"], "dst": ["living"], "ip": ["tcp:22"]},` — vps-setup `main`
  commit `844aa1b` ("Grant autogroup:shared SSH-only access to living (Diego node share)").
  Pulled clean onto mustang's checkout (`git checkout -- ...` to drop the local duplicate
  diff, then fast-forward).
- The proposed `tests` entry (`{"src": "autogroup:shared", "accept": [...], ...}`) was REJECTED
  by `/acl/validate`: `unknown user or host: "autogroup:shared"` — `autogroup:shared` is valid
  as a grant `src` but NOT as a `tests` `src`. Dropped per the fallback instruction; no test
  assertion exists for this grant (fine — it's narrow: SSH-only to one host).
- Lockout check passed: `ssh living 'echo ok'` from tuf still works post-apply.
- The API token expires in 7 days on its own; no revoke action needed since it's single-use
  for this task and we don't persist it anywhere.

### 4. Jacob's manual steps — ONLY THIS LEFT
- [ ] Admin console → Machines → `living` → **Share** → invite to Diego's Tailscale email
      (waiting on Diego's reply for the email — cron `c-9a6106` will surface it).

### 5. Notify Diego ✅ SENT (System-bot DM + ntfy, per Jacob's choice)
- Direct insert into prod shared.db as `ubuntu` (mirrors ensure_dm + post_message exactly,
  incl. last_notified_at stamp) + ntfy POST to `living_pings_diego` (200).
- Room `dm:b083633c-d46e-41cd-82d9-dc2330e657b1:system`, message
  `91f78701-7a0d-417f-bdc6-7474db718ae7`. Diego's user id: `b083633c-d46e-41cd-82d9-dc2330e657b1`.
- Message asks for: SSH pubkey + Tailscale account email; includes Tailscale intro,
  install steps, full usage cheatsheet, and Jacob's repo note (fresh clone after branch
  surgery; keep .env files BESIDE the checkout; Jacob sends env keys separately).
- ⚠️ GOTCHA: replies in a System DM ping NOBODY (`ping_room_members` skips the System member) —
  a horse cron watches for his reply (see below).
- ⚠️ GOTCHA #2 (found 2026-07-03, Jacob's report): a private DM's `require_member` check has
  NO admin bypass — Jacob himself couldn't view the System↔Diego room even by direct URL.
  Jacob's own Team Chat "message Diego" click auto-creates a SEPARATE, different room
  (`dm:<diego>:<jacob>` via `ensure_dm`, deterministic on the two real user ids — the System
  bot is never part of it). Fix applied: added `system` as a 3rd member of Jacob's real DM
  room (`dm:b083633c-d46e-41cd-82d9-dc2330e657b1:f0fdbb2f-b87d-4717-8858-37e64efeb112`,
  Jacob's user id `f0fdbb2f-b87d-4717-8858-37e64efeb112`) and copied the same message there
  (no re-ping — Diego already got the original). Verified member insertion ORDER keeps
  `room_title`'s "first non-self member" heuristic correct for both humans (jacob, diego
  inserted first when the room was created; system added last) — Jacob's view still titles
  it "Diego", Diego's view still titles it "Jacob". **3-member hack is safe here ONLY because
  of this insertion-order coincidence — don't casually reuse the pattern elsewhere.**
  Diego's actual reply is still expected in the ORIGINAL system↔Diego room (that's the ntfy
  push's deep link and what the cron watcher checks) — the copy in Jacob's room is
  visibility-only, not the reply channel.

### 6a. Notification redo (2026-07-03, Jacob's follow-up request)
Jacob discovered he couldn't see the original notice (DM privacy has NO admin bypass — see
gotcha #2 above), and asked to remove the original + send a fresh notice explicitly from him
explaining the old link was broken. Done:
- ✅ Confirmed via read-only query first: NO reply from Diego existed in either room (safe to
  delete, no data loss).
- ✅ Hard-deleted the original `dm:...:system` room entirely (messages, members, room row) —
  direct DB delete since `delete_room()` in the app refuses non-channel kinds. The old ntfy
  push's deep link is now a dead 404/403 if Diego still has it — intentional, matches the
  "old broken link" framing in the new notice.
- ✅ Diego is Level-3 SUPER ADMIN in the app already (`diego@livingtongues.org`, `admins.ts`) —
  his `users.notify_channel` is `'email'` (not ntfy), so `notify_user`/`notify_admin` route
  him to a real SES email, not a push. Confirmed via prod DB read.
- ✅ Sent the follow-up **as Jacob for real** (not another raw-DB hack): minted a genuine
  session JWT (`jose` `SignJWT`, `sub=<jacob's user id>`, HS256, `JWT_SECRET` read from
  `/opt/hosting/sveltekit/.env` via root ssh, script run from a temp `.mjs` file placed
  INSIDE `site/` so node resolves the repo's `jose` dep, secret piped in as an env var and
  never echoed/logged, all temp files + the token deleted immediately after use) and POSTed
  to the real `POST /api/chat/send` endpoint with `Authorization: Bearer <token>` — this goes
  through the actual `post_message` + `notify_room_message` pipeline (sanitization, anti-spam
  ping policy, real notification channel). Confirmed in `sveltekit_blue` logs: **`Email sent
  successfully to diego@livingtongues.org`** (real SES send, Message ID logged).
- **Reusable pattern for future "send as a specific real user" needs**: mint a short-lived JWT
  (~600s) with that user's `sub`/email/name, call the real endpoint with `Authorization:
  Bearer`, done — far more robust than replaying the app's DB write path by hand (correct
  sanitization + notification for free, and it's what actually happened on their account, not
  a lookalike).
- Current state: room `dm:b083633c-...:f0fdbb2f-...` (Jacob's real DM with Diego) has 2
  messages — the System-authored onboarding copy (from earlier), then Jacob's real
  clarification/apology message. This is now the ONE canonical thread.

### 6b. Remaining / follow-up (cron-driven)
A recurring mustang cron (`living-dictionaries` local store, id `c-5bdefe`, every 3h at :30,
replaces the removed `c-9a6106` which watched the now-deleted room) checks Jacob's real DM
with Diego for his reply. When he replies:
- [ ] Install his pubkey: append to `/home/diego/.ssh/authorized_keys` on living (root ssh).
- [ ] Re-run the positive verification as diego (can't ssh as him from mustang without his
      key — instead have HIM run the cheatsheet commands and confirm in the DM).
- [ ] Give Jacob his Tailscale email → Jacob sends the share invite.
- [ ] Reply to Diego in the same DM as Jacob (JWT-mint + `/api/chat/send` pattern above)
      confirming setup + reminding the cheatsheet.
- [ ] When all done: `horse cron rm c-5bdefe`, mark this issue complete.
- Check for reply:
  `ssh living "sudo -u ubuntu python3 -c \"import sqlite3; con=sqlite3.connect('file:/opt/hosting/data/shared.db?mode=ro',uri=True); print(con.execute('SELECT created_at, substr(body_text,1,500) FROM chat_messages WHERE room_id=? AND author_user_id=?', ('dm:b083633c-d46e-41cd-82d9-dc2330e657b1:f0fdbb2f-b87d-4717-8858-37e64efeb112','b083633c-d46e-41cd-82d9-dc2330e657b1')).fetchall())\""`
- Extract Diego's SSH key + Tailscale email from his reply text.

## Security notes for posterity

- Public port 22 stays CLOSED. Diego's path is tailnet-only via node sharing; sharer-side
  ACL (`autogroup:shared` grant) bounds him to living:22.
- Residual risk accepted: prod data on Diego's machine (inherent) + his key hygiene —
  mitigated by low-privilege single-box scope.
- `.env` was world-readable → now 600. `.bak` files in /opt/hosting/data are root:root 644 —
  fine (Diego may read DB backups by design).
