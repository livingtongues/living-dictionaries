# Unguarded promises — `void promise` is not a guard

From the 2026-07-27 fleet-wide audit (the same bug class surfaced independently in all three
repos; LD's instance: four real visitors tapped play 3–7 times and got silence, and telemetry
could not say why). Full audit table in git history:
`.issues/unguarded-promise-audit-2026-07-27.md`.

## The rule

`void some_promise()` silences the linter, not the rejection. A fire-and-forget promise whose
failure gates a user-facing feature (audio `play()`, a lazy `import()`, a data fetch feeding
`$state`) MUST carry a `.catch` that either surfaces the failure to the user or logs it with a
message naming the feature — otherwise the failure is an anonymous unhandled rejection and the
feature silently dies.

Use bare `void` ONLY when the callee is known to swallow its own errors, and say so at the call
site.

## Safe by construction (don't re-audit these)

- **Every `void <call>()` through the `_call.ts` API pattern** (`api_chat_rooms`,
  `api_chat_heartbeat`, …) — those helpers return `{ data, error }` and never throw. This is one
  of the reasons the pattern is worth keeping.

## Related trap: module-level promise caches

A lazy loader that caches its in-flight promise (`if (!cache) cache = import(...)`) keeps a
REJECTED promise forever — one failed chunk fetch poisons every later caller. Clear the cache on
rejection so a retry is possible (see `load_keyman_writing_systems` in
`$lib/components/keyboards/keyman/writing-systems.ts`).
