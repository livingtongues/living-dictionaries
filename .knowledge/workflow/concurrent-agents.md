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
