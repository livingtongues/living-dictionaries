# The catch block cannot recover what the throw destroyed

**Standing rule, adopted 2026-08-02** (portfolio-wide; house and tutor are adopting the same
wording). Earned in LD by the media-deletion sweep described below.

> A `catch` may only produce a value the caller can act on **honestly**. If the thing that threw was
> the very thing that would have told you the answer, the catch has no answer — and it must say so,
> not invent a plausible one. **Silence plus a default is the failure mode; the default is almost
> always the empty/zero value, which is also the most destructive one.**

## The shape to look for

```ts
try {
  live = read_the_thing()   // ← the ONLY source of truth for what follows
} catch {
  // (a comment, and nothing else)
}
act_on(live)                // ← now acts on the empty default
```

Three properties make it dangerous, and all three have to be present before it's worth a fix:

1. **The catch swallows the only source of truth.** Not a nice-to-have side channel — the input the
   next step is a function of.
2. **The empty default is indistinguishable from a real, expected state.** "This dictionary
   references no media" is a thing that genuinely happens, so no downstream check can catch it.
3. **The next step is irreversible or clock-starting.** Deleting, marking-for-deletion, emailing,
   charging, publishing.

A catch that fails property 2 or 3 is fine and should be left alone (see "Legitimate catches" below).

## LD's worked instance — the media sweep (fixed 2026-08-02)

`$lib/db/server/media-sweep-cron.ts` built the set of media still in use by opening each
dictionary's own SQLite file. That read sat in a `try` whose `catch` body **was a comment and
nothing else**. Any failure — missing file, locked db, permissions, a renamed column — produced an
empty in-use set, and an empty in-use set marks *every* stored file for that dictionary as an
orphan, which starts a **30-day deletion countdown on real user media**.

The 30-day grace is why nothing was ever lost: a *brief* failure is undone by the next weekly sweep.
It is no protection at all against a **quiet, persistent** one, which is exactly what this design
cannot tell apart from a genuinely emptied dictionary.

The fix (all three parts matter):

- `live_keys_for_dict()` returns `{ ok, keys, dictionary_deleted, error }` — a **refusal to answer**
  is representable. A read failure is `ok: false`; the caller logs `media_sweep_dict_unreadable` at
  error level and skips that dictionary whole.
- "The dictionary is gone from the catalog" is now a *distinct, checked* state
  (`dictionary_deleted`), so genuine reclamation still works instead of being sacrificed to safety.
- A **proportion brake** (`orphan_brake_tripped`) refuses to newly-orphan an implausible share of one
  dictionary's objects in a single sweep and logs `media_orphan_brake_tripped`. That covers the
  failures that never throw at all — a renamed table, a half-restored file — which no `catch`
  discipline could have caught.

### Why house's version of this file was NOT copied

house's equivalent read is simply **unguarded**: a failure throws, the outer handler records
`media_sweep_failed`, and nothing is marked. That is the right *outcome*, arrived at by not writing a
`catch` rather than by deciding anything. Porting the shape into LD would have produced an uncaught
throw with no log line for the specific dictionary — a second silent failure, with a whole sweep
dying instead of one dictionary being skipped. **The correct change was neither repo's code.**

This is the same trap as 2026-07-26, when endorsing house's naming lesson while missing its precision
fix blanked the app for real phones inside 24 hours: *a sibling repo getting the right answer is not
evidence that its code is the right code.*

## Legitimate catches — do not "fix" these

- **`JSON.parse` of a stored column** (`dict-home.ts` `parse_json_column`, the sweep's own
  `featured_image` parse). The catch produces "no value", the caller renders nothing, and no
  irreversible step follows. Property 3 absent.
- **`log_server_event` / `insert_client_log` swallowing their own errors.** Logging must never spawn
  more errors, and a lost telemetry row fabricates nothing — it is absent, not wrong.
- **`get_rollup_watermark()` returning `null` on a read failure.** `null` means "never finalized", so
  the sweep re-rolls the whole hot window: wasteful, self-correcting, nothing destroyed. Property 3
  absent — but it is the closest sibling in the codebase, and if the watermark ever gains a
  destructive consumer it moves into scope.
- **`/proc` and `statfs` reads in `host-stats.ts` degrading to `null`.** The field is *reported as
  unknown*, which is the honest answer, not a fabricated zero.

The distinction in one line: **`null` that means "unknown" is honest; `[]` / `0` / `new Set()` that
means "nothing, therefore proceed" is a fabrication.**

## When you add a new catch

Ask the three questions above. If it's in scope, the shape that works is:

1. make refusal representable in the return type (`ok: false`, not a bare empty value);
2. log it at a level someone would actually see, naming the thing that failed;
3. if there's a step downstream that consumes counts, add a brake on the *magnitude* too — the
   failures that never throw are the ones the type system can't help you with.
