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

### 3. Tailnet ACL grant — ⏳ BLOCKED on API token
- ✅ Edit prepared in `~/code/vps-setup/mustang/tailscale-acl.hujson` (uncommitted, on mustang
  AND mirrored by the tuf session in its checkout):
  `{"src": ["autogroup:shared"], "dst": ["living"], "ip": ["tcp:22"]},`
- 🚫 NO Tailscale API token exists on tuf OR mustang (both searched exhaustively — the
  2026-06-10 apply used an ephemeral console token). Jacob must mint one
  (admin console → Settings → Keys) — asked in session, awaiting answer.
- tuf session `39adb4c8-4c2b-49d4-8dba-4b90de63833e` (project vps-setup) is idle-blocked with
  the same edit staged; abort it if mustang does the apply.
- After successful apply: commit ONLY the hujson change in vps-setup on main + push
  ("Grant autogroup:shared SSH-only access to living (Diego node share)").
- Tests entry `{"src": "autogroup:shared", ...}` validity unknown — drop it if /acl/validate rejects.

### 4. Jacob's manual steps
- [ ] Mint Tailscale API access token → paste in session (asked).
- [ ] Admin console → Machines → `living` → **Share** → invite to Diego's Tailscale email
      (waiting on Diego's reply for the email).

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

### 6. Remaining / follow-up (cron-driven)
A recurring mustang cron (`living-dictionaries` local store, id `c-9a6106`, every 3h at :30)
checks the DM for Diego's reply. When he replies:
- [ ] Install his pubkey: append to `/home/diego/.ssh/authorized_keys` on living (root ssh).
- [ ] Re-run the positive verification as diego (can't ssh as him from mustang without his
      key — instead have HIM run the cheatsheet commands and confirm in the DM).
- [ ] Give Jacob his Tailscale email → Jacob sends the share invite.
- [ ] Reply to Diego in the same DM (same direct-insert method; script pattern preserved
      below) confirming setup + reminding the cheatsheet.
- [ ] When all done: `horse cron rm` the watcher, mark this issue complete.
- Check for reply:
  `ssh living "sudo -u ubuntu python3 -c \"import sqlite3; con=sqlite3.connect('file:/opt/hosting/data/shared.db?mode=ro',uri=True); print(con.execute('SELECT created_at, substr(body_text,1,500) FROM chat_messages WHERE room_id=? AND author_user_id=?', ('dm:b083633c-d46e-41cd-82d9-dc2330e657b1:system','b083633c-d46e-41cd-82d9-dc2330e657b1')).fetchall())\""`
- To post a reply as System: mirror the insert script (ensure room exists → INSERT chat_messages
  → bump chat_rooms.updated_at → stamp diego's last_notified_at + gentle_reping_at=NULL → ntfy
  `living_pings_diego` with Title/Click headers). Run as `sudo -u ubuntu python3` to keep
  file ownership. Extract Diego's SSH key from his reply text.

## Security notes for posterity

- Public port 22 stays CLOSED. Diego's path is tailnet-only via node sharing; sharer-side
  ACL (`autogroup:shared` grant) bounds him to living:22.
- Residual risk accepted: prod data on Diego's machine (inherent) + his key hygiene —
  mitigated by low-privilege single-box scope.
- `.env` was world-readable → now 600. `.bak` files in /opt/hosting/data are root:root 644 —
  fine (Diego may read DB backups by design).
