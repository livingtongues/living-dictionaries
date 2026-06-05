# tooling/

Dev tooling that augments the app but isn't part of the shipped runtime.

- [sqlite-proxy.md](./sqlite-proxy.md) — dev-only HTTP+WS proxy + `live_share` + `sqlite-query.sh`
  for running SQL against the live browser wa-sqlite DBs (admin `shared.db` + per-dict `dict.db`).
  Shared pattern with house/tutor; LD's multi-target/composite-client + write-aware specifics.
