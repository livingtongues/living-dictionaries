# Concurrent agents share ONE working tree — treat it as shared mutable state

Lesson from the 2026-07-12 clobber incident (recovery: `.issues/clobber-recovery-2026-07-12.md`):
a button-migration codemod agent ran `git checkout -- $(grep -rl …)` on ~54 `.svelte` files to
revert its own bad codemod pass — while TWO other sessions were mid-refactor with uncommitted
changes in the same tree. The revert restored HEAD over their edits; ~10 files of refactor work
had to be replayed from the sessions' JSONL transcripts (`originalFile` + old/new pairs in
`~/.claude/projects/<project>/<session>.jsonl` make this recoverable — full Write contents and
every Edit's pre-image are all there).

Hard rules (any agent, this repo or others):

1. **Before any bulk revert/checkout/reset or repo-wide codemod**, run `horse list --project <p>`
   AND `git status` — if other sessions are `listening`/mid-work or the tree has uncommitted
   changes you didn't make, do NOT revert shared files. Scope reverts to files YOU changed
   (you know them from your own transcript), or stash-selectively, or ask Jacob.
2. **Never `git checkout -- <dynamic-file-list>`** built from a content grep — the list will
   include other agents' files that merely contain the same symbol.
3. If a clobber does happen: stop editing immediately, build the mutation timeline from all
   sessions' JSONLs (timestamps on every tool_use), and replay per-file. Watch for post-revert
   sed/codemod passes — damaged files may be HEAD+codemod, not clean HEAD, so replay the
   *transformation*, don't blind-restore pre-revert content.

## Production data is shared mutable state too — not just the working tree

The same "check who else is running" rule applies to the **prod dictionary DBs**, and it's
easier to forget because nothing local warns you.

Encountered 2026-07-28: a grammar-page session was about to PATCH prod `ponca`
`grammar_sections` (an ALL-CAPS → Title Case rewrite) while a *different* session was in the
middle of a long-running bulk prod patch of the same dictionary's entries/senses from a
Ponca import audit.

How to check, and what the tells are:

1. `horse list --all-hosts` — a session whose title names the same dictionary/feature is a
   red flag. `python3 ~/code/horse/scripts/extract-session-text.py <jsonl>` shows what it is
   actually doing right now (tool markers are enough).
2. **Poll the DB for live writes** — the definitive test, since a session can be `listening`
   while a backgrounded job still writes:
   `SELECT MAX(updated_at) FROM entries` twice, ~45s apart. Moving = hands off.
3. A whole table sharing ONE identical `updated_at` means a bulk re-import/merge just ran,
   not human edits — expect the shape of the data to have changed under you (Ponca's grammar
   went from nested-under-one-root to 20 flat top-level sections between two reads).
4. `horse send <project> <session-id> "<question>"` is the coordination primitive — ask
   whether they plan further writes to YOUR table before you start.

Also: `site/.data/dictionaries/*.db` is shared between sessions on the same box (agents pull
prod copies into it). Don't overwrite one to get a fresh copy — `VACUUM INTO` a scratch path
(e.g. `/tmp/…`) and read from there.

### Don't whole-file-rewrite a shared file to make a one-line change
Adding one i18n key with a `json.load` → `json.dump` round-trip on
`site/src/lib/i18n/locales/en.json` is a read-modify-write over a file other sessions edit
constantly; it got away with it (the other session's keys survived), but the same move loses
whatever landed between the read and the write, and can reflow the entire file into an
unreviewable diff. Use a targeted `Edit` on the surrounding lines instead, and check
`git diff <file>` afterwards — you should see ONLY your line plus any concurrent additions.
