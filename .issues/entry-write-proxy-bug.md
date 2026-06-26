# Entry-write `#writes` proxy bug — found + fixed + verified (cutover blocker)

Spun off 2026-06-26 from the logging-buildout live-testing (`.issues/logging-buildout.md`), which
had one open item: the editor entry-WRITE + `/changes` push path was never auto-verified. Driving
that verification surfaced — and fixed — a **critical, cutover-blocking** bug.

## The bug
On the new VPS/wa-sqlite stack, **every editor write threw** and popped an `alert()` — so NO editor
could create an entry, add a sentence, add audio/photo/video, or link/unlink junctions. Latent
because the editor write path had never been exercised on this stack (same reason the better-sqlite3
client-leak crash went unnoticed until this session).

Root cause: `create_dict_live_db` (`dict-live-db.svelte.ts`) wraps the `DictLiveDbImpl` instance in a
`Proxy`. Its `get` trap resolved properties with `Reflect.get(target, prop, receiver)` — passing the
**proxy** as the receiver. The `get writes()` getter reads `this.#writes`; a **private-field brand
check throws when `this` is the proxy** (`TypeError: Cannot read private member #writes from an object
whose class did not declare it`). `insert_entry`'s `catch` then `alert(err)`'d it. (House has the
same proxy pattern but no `#private`-backed getter, so it never tripped.)

## The fix ✅
`Reflect.get(target, prop, target)` — resolve getters with the real instance as the receiver so
private fields work. Methods were already `.bind(target)`. Commit `b21c6894` on `svelte-5-migration`.
- Regression test `dict-live-db-proxy.test.ts` (verified red→green): asserts `db.writes.insert_entry`
  is callable through the proxy without throwing.

## Verification ✅ (both local dev AND live subdomain)
Driven headless via `site/tools/e2e/local-create-entry.mjs` + `subdomain-create-entry.mjs`:
- Live `new.livingdictionaries.app` (post-deploy, VPS at `b21c6894`): create dict → open → add-entry
  modal → submit → **server `/data/dictionaries/<id>.db` got 1 entry** (`{"default":"wfixword-…"}`),
  server `dict_changes_pushed` logged `{dirty_rows:2,deletes:0}`, entry detail rendered, and
  `entry_opened` fired. **No alert dialog.**

## How the hang was mis-diagnosed before (corrected in `.knowledge/testing/browser-deep-flow.md`)
The previous session thought the **Keyman** keyboard blocked the main thread headless. It doesn't —
the block was the unhandled `alert()`. Registering `page.on('dialog', d => d.dismiss())` both unblocks
puppeteer AND surfaces the real error via `d.message()`. The editor write verifies fine headless.

## Remaining follow-ups (non-blocking)
- [ ] **`alert(err)` in `operations.ts` catch blocks is poor UX** — it freezes the tab until dismissed
  and is opaque. Consider a toast + telemetry instead (every `insert_*`/`delete_*` uses this pattern).
- [ ] Consider a **server-rendered build** (`node build`) local e2e in CI for the write path so this
  class of "only breaks on the real stack" bug is caught before deploy (unit tests pass with the bug).
- [ ] Audit other `#private`-backed getters reachable through the proxy (only `writes` today).
