# Audit — `$effect` usage in living-dictionaries

**Report-only.** No code was changed. Scope: `site/src/**` app code + a separate section for the
vendored `site/src/lib/svelte-pieces/**`.

> **Status: fixes applied (2026-06-07).** Bugs + ⚠️ cleanup + the clear 🔁/🖱️ conversions are done.
> Verified: `pnpm check` (0 errors) + eslint on touched files (0 errors). Done:
> - ✅ `IntersectionObserverShared.svelte:80` — added `return () => clearInterval(interval)` teardown (interval leak fixed)
> - ✅ `Zoomer.svelte:32` — added `return () => select(context.canvas).on('.zoom', null)` teardown
> - ✅ `Recorder.svelte:33` — effect now returns `() => new_recorder.stopRecording()`; dropped `untrack`; `onDestroy` now clears the timer interval (genuine missing cleanup)
> - ✅ `MediaStream.svelte:37` — replaced seeding effect with `effective_microphone`/`effective_camera` `$derived`; `requestStream` + snippet read those
> - ✅ `ReactiveSet.svelte:8` — replaced effect with `const set = $derived(new SvelteSet(input || []))`
> - ✅ `schema/+page.svelte:30` — lazy import moved into `load_graph()`, called from `onMount` (default view) + the graph-tab `show_graph` handler
> - ✅ `persisted-state.svelte.ts:13` — dropped the redundant in-effect `if (browser)`
>
> **Left as-is per decision:** `LoginModal:16` (mechanically fine; AuthModal shared), the two ❓
> judgment calls (`DictionaryPoints:63` animation, `schema-graph:50` PersistedState ctor), and
> `schema-graph:69` reset (a `{#key}` would remount the whole graph). All ✅ legitimate effects untouched.

## Doc rules this audit grades against

Pulled from the official Svelte 5 docs (via the repo `svelte` skill):

> "Effects are an escape hatch and should mostly be avoided. In particular, avoid updating state
> inside effects." — `$state`/best-practices

> "Generally speaking, you should _not_ update state inside effects, as it will make code more
> convoluted and will often lead to never-ending update cycles." — `$effect`

> "In general, `$effect` is best considered something of an escape hatch — useful for things like
> analytics and direct DOM manipulation … In particular, avoid using it to synchronise state."
> — `$effect` › *When not to use `$effect`*

> "If you need to run some code in response to user interaction, put the code directly in an event
> handler … If you need to sync state to an external library such as D3, it is often neater to use
> `{@attach ...}` … If you need to observe something external to Svelte, use `createSubscriber`." —
> best-practices

> An effect "can return a _teardown function_ which will run immediately before the effect re-runs"
> and "when the component is destroyed." — `$effect` › teardown. (Effects that start
> intervals/listeners/observers and *don't* return teardown are a leak/cleanup smell.)

Legitimate `$effect` per the docs = a genuine **side effect with no reactive return value**: DOM
measurement/scroll, `addEventListener`/observers, third-party imperative libs (d3, tiptap,
RecordRTC), `localStorage`/URL persistence, subscriptions with teardown.

---

## Exec summary

20 `$effect` call sites total — **15 in app code**, **5 in svelte-pieces**.

| Verdict | App | Pieces |
|---|---|---|
| ✅ Legitimate side effect | 7 | 3 |
| 🔁 Should be `$derived` | 2 | 1 |
| 🖱️ Should be event handler | 2 | 0 |
| ⚠️ Risky (loop / missing teardown / over-fires) | 1 | 1 |
| ❓ Needs human judgment | 3 | 0 |

### Top fixes (highest impact first)

1. **🐞 `IntersectionObserverShared.svelte:80` leaks intervals** — starts a `setInterval` on every
   `intersecting → true` but only clears it in `onDestroy`, never on re-run. Toggle visibility a few
   times and you stack live intervals. Real bug. *(svelte-pieces — cross-repo sensitive.)*
2. **⚠️ `Zoomer.svelte:32` registers a fresh d3 zoom behavior with no teardown** — re-runs when
   `projection`/`context` change and re-`.call()`s a new behavior on the same canvas without removing
   the old listeners.
3. **🖱️ `schema/+page.svelte:30` lazy-imports the graph component inside an `$effect`** — this is a
   one-shot, user-action-driven load; belongs in the tab-switch handler.
4. **🔁 `ReactiveSet.svelte:8` rebuilds a `SvelteSet` from `input` in an effect** — textbook
   "synchronise state" anti-pattern; convertible to `$derived`. *(svelte-pieces.)*
5. **🔁 `MediaStream.svelte:37` seeds selected mic/camera from derived lists in an effect** — a
   defaulting/derive-state pattern that an "effective selection" `$derived` expresses more directly.

---

## App code — full table

| file:line | what it does | verdict | recommendation |
|---|---|---|---|
| `site/src/lib/components/record/MediaStream.svelte:37` | sets `selectedMicrophone/Camera` stores to `microphones[0]/cameras[0]` if unset | 🔁 | derive an "effective" selection instead of writing state |
| `site/src/lib/components/record/Recorder.svelte:33` | instantiates a RecordRTC recorder when lib/stream/options change | ✅ (⚠️ note) | legit imperative-lib setup; prefer a `return () => recorder.stopRecording()` teardown over `untrack` stop |
| `site/src/lib/components/LoginModal.svelte:16` | on auth completion → `invalidateAll()` + `on_close()` | 🖱️/❓ | prefer an `on_success` callback from `AuthModal` over watching `page.data` |
| `site/src/lib/components/globe/Canvas.svelte:72` | `scale_canvas()` when canvas/context/size change | ✅ | keep — direct canvas manipulation |
| `site/src/lib/components/globe/DictionaryPoints.svelte:63` | on `is_moving` toggle, animate label opacity + run d3 force sim, cache nodes | ❓ | animation/sim orchestration; see note |
| `site/src/lib/components/globe/DictionaryPoints.svelte:257` | touches projection/opacity/selection/dictionaries → `invalidate()` | ✅ | keep — imperative canvas redraw trigger |
| `site/src/lib/components/globe/Zoomer.svelte:32` | wires a d3 zoom behavior onto the canvas | ⚠️ | legit setup but **no teardown**; remove old behavior on re-run (or `{@attach}`) |
| `site/src/lib/components/globe/Globe.svelte:86` | `projection.fitExtent/clipExtent` on size change → `invalidate()` | ✅ | keep — imperative d3 projection mutation |
| `site/src/lib/db/client/live/table-store.svelte.ts:81` | ref-counts subscribers, starts/stops live query, returns teardown | ✅ | keep — subscription with teardown (could be `createSubscriber`) |
| `site/src/lib/db/dict-client/dict-live-db.svelte.ts:135` | same ref-count subscription pattern for dict DB | ✅ | keep — subscription with teardown |
| `site/src/routes/admin/schema/graph/schema-graph.svelte:50` | constructs a `PersistedState` when `storage_key` changes | ❓ | derive-an-object-from-key; tricky because ctor uses `$effect`/`onDestroy` — see note |
| `site/src/routes/admin/schema/graph/schema-graph.svelte:69` | resets `focused_table_id = null` when `schema.source_label` changes | 🔁/⚠️ | reset-on-prop-change; `{#key schema.source_label}` is the idiomatic reset |
| `site/src/routes/admin/schema/+page.svelte:30` | dynamic-imports the graph component when `view_mode==='graph'` | 🖱️ | move the import into the tab-switch handler |
| `site/src/routes/admin/sync/+page.svelte:32` | autoscrolls the log container when new entries arrive | ✅ | keep — DOM scroll; consider `$effect.pre` (matches docs autoscroll example) |
| `site/src/routes/admin/messages/[thread_id]/+page.svelte:67` | marks a thread read on first view + `_save()` | ✅ (⚠️ note) | acceptable one-shot persist; reads+writes `thread` so keep the `marked_read` guard |

---

## Per-item notes (the non-trivial ones)

### 🔁 `MediaStream.svelte:37` — seeding selection from derived lists

```ts
const microphones = $derived(devices.filter(d => d.kind === 'audioinput'))
const cameras = $derived(devices.filter(d => d.kind === 'videoinput'))
$effect(() => {
  if (!$selectedMicrophone) selectedMicrophone.set(microphones[0])
  if (!$selectedCamera) selectedCamera.set(cameras[0])
})
```

**Rule violated:** "avoid using it to synchronise state." This writes `$state`/store from values
that are themselves derived from `devices`. It doesn't loop (the `if (!…)` guard self-limits), so
it's not dangerous — but it's the deriving-state shape. The wrinkle: the selection is *also* mutated
imperatively by `chooseMicrophone/chooseCamera` and lives in a module-level store, so it's a
"seed-then-locally-override" source of truth, like the optimistic-UI case in the docs.

**Sketch** — express the effective selection as a derived and read *that* in `requestStream`,
dropping the seeding effect:

```diff-ts
-$effect(() => {
-  if (!$selectedMicrophone) selectedMicrophone.set(microphones[0])
-  if (!$selectedCamera) selectedCamera.set(cameras[0])
-})
+const effective_microphone = $derived($selectedMicrophone ?? microphones[0])
+const effective_camera = $derived($selectedCamera ?? cameras[0])
```

Then `requestStream`/the snippet read `effective_microphone`. `chooseMicrophone` still `.set(...)`s
to pin a real choice. (Judgment call: if downstream code truly needs the store *populated*, keep an
effect but this is the cleaner shape.)

### ❓ `DictionaryPoints.svelte:63` — animation + force-sim on `is_moving`

```ts
$effect(() => {
  if (is_moving) {
    label_opacity.set(0, { duration: 0 })
  } else {
    cached_nodes = run_force_simulation(get_visible_points())
    label_opacity.set(1)
  }
})
```

Reads the `is_moving` prop; writes a tweened store and the plain `cached_nodes` var, and runs a 200-
tick d3 force simulation. This is genuinely side-effecty (driving an animation + heavy imperative
compute), so it's not a pure derive. But `is_moving` is *driven by user pan/zoom* — the move
start/end already fire through `on_move_start`/`on_move_end` up in `Globe.svelte`. **Tradeoff:**
running the relayout from those existing move-end handlers (event-driven) would be more in the spirit
of "respond to interaction in a handler," whereas the effect re-runs purely off the boolean. Leave as
effect if you prefer the prop to be the single trigger; otherwise hoist into the move-end path.

### ⚠️ `Zoomer.svelte:32` — d3 zoom setup with no teardown

```ts
$effect(() => {
  if (projection && context) {
    const zoom_behavior = versor_zoom(projection, { … })
    zoom_behavior.on('start.move', …)
    zoom_behavior.on('zoom.render', () => invalidate())
    zoom_behavior.on('end.move', …)
    select(context.canvas).call(zoom_behavior)
  }
})
```

**Rule:** effects that attach behavior should "return a teardown function." If `projection` or
`context` ever change, this re-runs and `.call()`s a second zoom behavior on the same canvas without
detaching the first — duplicate listeners. Add a teardown:

```diff-ts
   select(context.canvas).call(zoom_behavior)
+  return () => select(context.canvas).on('.zoom', null)
```

The docs further suggest `{@attach ...}` as "neater" for syncing to a library like D3 — a good
future refactor, but the teardown is the immediate fix.

### 🔁/⚠️ `schema-graph.svelte:69` — reset state on prop change

```ts
$effect(() => {
  schema.source_label // tracked
  untrack(() => { focused_table_id = null })
})
```

Resetting local state when an input changes. It's guarded with `untrack` so it won't loop, and the
intent is documented. Still, the idiomatic Svelte 5 way to reset child state on an input change is a
keyed block (`{#key schema.source_label} … {/key}`) or recomputing via `$derived`. Low risk; flag as
convertible, not broken.

### ❓ `schema-graph.svelte:50` — constructing `PersistedState` from a derived key

```ts
const storage_key = $derived(`schema_graph_v1:${schema.source_label}`)
let persisted = $state<PersistedState<…> | null>(null)
$effect(() => {
  const key = storage_key
  untrack(() => { persisted = new PersistedState(key, { … }) })
})
```

Surface reading says "derive it": `const persisted = $derived(new PersistedState(storage_key, …))`.
**But** `PersistedState`'s constructor itself calls `$effect(...)` and `onDestroy(...)`
(`persisted-state.svelte.ts:13,22`) — constructing it inside a `$derived` would run those in a
non-effect/derived context and the old instance's `onDestroy` wouldn't fire on key change. The effect
+ `untrack` is a reasonable way to get "rebuild when key changes" with correct lifecycle. Keep, or
refactor `PersistedState` to not register lifecycle in its constructor. Human call.

### 🖱️ `schema/+page.svelte:30` — lazy import inside an effect

```ts
$effect(() => {
  if (view_mode !== 'graph' || SchemaGraph || !browser) return
  graph_loading = true
  import('./graph/schema-graph.svelte').then(m => { SchemaGraph = m.default }).finally(() => { graph_loading = false })
})
```

**Rule:** "If you need to run some code in response to user interaction, put the code directly in an
event handler." Switching to the graph view is a click. The `!browser` guard is itself a smell the
docs warn about ("Never wrap the contents of an effect in `if (browser)`… effects do not run on the
server"). Move the dynamic import into the handler that sets `view_mode = 'graph'` (load-once guard
preserved by the `if (SchemaGraph) return`).

### 🖱️/❓ `LoginModal.svelte:16` — watching `page.data` for auth completion

```ts
$effect(() => {
  if (auth_user?.user) { void invalidateAll(); on_close() }
})
```

Fine as-is mechanically, but the cleaner pattern is for `AuthModal` to expose an `on_success`
callback fired when verification completes, rather than this component reactively polling
`page.data.auth_user`. Judgment call — depends on whether `AuthModal` is shared elsewhere.

### ✅ `messages/[thread_id]/+page.svelte:67` — mark-read one-shot

Reads `thread` + `marked_read`, writes `marked_read` and `thread.read_at` then `_save()`. It both
reads and writes `thread`, but the `marked_read` boolean makes it strictly one-shot, so no loop. This
is a legitimate "persist a side effect when async data first arrives" use. Keep the guard.

---

## Patterns observed

- **Imperative-canvas / d3 cluster (globe):** `Canvas:72`, `DictionaryPoints:257`, `Globe:86`,
  `Zoomer:32` are all "mutate a d3/canvas object and `invalidate()`." These are the *correct* use of
  `$effect` per the docs (direct DOM/library manipulation) — only `Zoomer` needs a teardown. A future
  pass could express several as `{@attach ...}`.
- **Live-query subscription stores:** `table-store` and `dict-live-db` use the identical
  `if ($effect.tracking()) { $effect(() => { …ref-count…; return teardown }) }` pattern — exactly the
  `createSubscriber`-style abstraction the docs bless. Solid; could literally be `createSubscriber`.
- **Set-state-from-input (the anti-pattern):** `MediaStream:37`, `schema-graph:69` (reset),
  `ReactiveSet:8` (pieces) all write `$state` derived from props/other state. All convertible to
  `$derived` or a keyed block.
- **One-shot work that's really an event:** `schema/+page:30` (lazy import on tab click) and
  `LoginModal:16` (auth-complete) want to be handlers/callbacks, not reactive watchers.
- **`if (browser)` inside effects** appears in `schema/+page:30` and `persisted-state.svelte.ts:14` —
  the docs explicitly call this out as unnecessary (effects don't run on the server).

---

## svelte-pieces (vendored — changes are cross-repo sensitive)

> ⚠️ `site/src/lib/svelte-pieces/**` is shared/copied across tutor/house/LD with per-repo tweaks. Any
> change here should be made deliberately and ideally ported in lockstep — don't fix in isolation.

| file:line | what it does | verdict | recommendation |
|---|---|---|---|
| `site/src/lib/svelte-pieces/functions/ReactiveSet.svelte:8` | rebuilds a `SvelteSet` from the `input` prop | 🔁 | derive it (see below); preserve local add/remove override |
| `site/src/lib/svelte-pieces/functions/IntersectionObserverShared.svelte:80` | starts an `on_intersected` interval when visible / `on_hidden` when not | ⚠️ 🐞 | **interval leak** — return teardown that clears it |
| `site/src/lib/svelte-pieces/RichTextEditor.svelte:153` | pushes external `value` into the tiptap editor, guarded against loops | ✅ | keep — imperative third-party editor sync (good guard) |
| `site/src/lib/svelte-pieces/RichTextEditor.svelte:167` | `editor.setEditable(!disabled)` when `disabled` changes | ✅ | keep — imperative editor sync |
| `site/src/lib/svelte-pieces/persisted-state.svelte.ts:13` | writes `value` to `localStorage` on change | ✅ | keep — external persistence (drop the inner `if (browser)` per docs / guard at register) |

### ⚠️🐞 `IntersectionObserverShared.svelte:80` — interval leak

```ts
$effect(() => {
  if (intersecting === true) {
    if (intervalMs) {
      interval = setInterval(() => { if (intersecting === true) on_intersected?.() }, intervalMs)
    }
  } else {
    on_hidden?.()
  }
})
onDestroy(() => { clearInterval(interval) })
```

Every time `intersecting` flips back to `true` a **new** interval is created; the previous one is
only ever cleared in `onDestroy`. Repeated visibility toggles → multiple concurrent intervals all
firing `on_intersected`. The fix is the standard effect teardown:

```diff-ts
 $effect(() => {
   if (intersecting === true) {
     if (intervalMs) {
       interval = setInterval(() => { if (intersecting === true) on_intersected?.() }, intervalMs)
+      return () => clearInterval(interval)
     }
   } else {
     on_hidden?.()
   }
 })
```

### 🔁 `ReactiveSet.svelte:8` — seed set from prop

```ts
const set = new SvelteSet()
$effect(() => {
  set.clear()
  for (const item of input || []) set.add(item)
})
```

"Synchronise state" anti-pattern. Because the set is *also* mutated by the local `add`/`remove`
helpers, it's a seed-then-override source of truth — the docs' optimistic-UI case, which `$derived`
now supports via override:

```diff-ts
-const set = new SvelteSet()
-$effect(() => {
-  set.clear()
-  for (const item of input || []) set.add(item)
-})
+const set = $derived(new SvelteSet(input || []))
```

…then `add`/`remove` mutate `set` directly (the derived can be locally overridden). Verify the
consumer behavior matches before porting across repos — this component is shared.

---

*Audit complete. No source files were modified.*
