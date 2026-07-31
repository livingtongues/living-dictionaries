# Legacy duplicate dictionary-role wedge — production verification remains

> Fix is COMPLETE and committed (full analysis in git history of this file): a pulled
> `dictionary_roles` row now detects a differently-id'd clean local owner of the same
> `(dictionary_id, user_id, role)` natural key and deletes/adopts it; dirty local collisions are
> preserved unless the same sync response authoritatively supersedes them; engine-convergence
> regression test covers the pre-existing clean-loser shape.

- [ ] Verify Dr. Greg Anderson's admin mirror resumes syncing on the deployed build (his
      sessions were halting with `UNIQUE constraint failed: dictionary_roles.…` — query
      `client_logs` for his sessions on the current build). Do not ask him to clear browser
      storage unless targeted convergence cannot safely repair it.
