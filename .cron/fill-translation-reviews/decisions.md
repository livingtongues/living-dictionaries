# fill-translations — standing decisions

Jacob's rulings for this lane. Read this before running `/fill-translations`, and never
re-litigate an entry here. Newest first.

---

## 2026-07-29 — fill-translations NEVER pushes or commits

Make changes, leave them uncommitted for Jacob. Do not re-propose push authorization.

The lane used to `git commit` the refreshed locale seed files and `git push main`, which is a
**deploy of the whole site**. That is Jacob's decision, not a nightly lane's — and it is the same
contract every other worker already operates under. Writing production `shared.db` is unchanged
and still the lane's product; only the git steps are gone. Reflected in
`.claude/commands/fill-translations.md` §4 and §5.
