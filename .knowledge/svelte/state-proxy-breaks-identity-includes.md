# `$state` deep-proxies objects → identity checks (`.includes`, `===`) silently fail

## Symptom

A component that reconciles a "currently active/highlighted item" against a
filtered list inside an `$effect` throws **`effect_update_depth_exceeded`**
("Maximum update depth exceeded… an effect reads and writes the same piece of
state"). In LD this surfaced as **"the parts of speech menu freezes after the
first search attempt; refreshing the page is needed"** (Diego, 2026-07-14) —
`MultiSelect.svelte` (used by `ModalEditableArray` → `EntryPartOfSpeech`).

## Root cause

`let activeOption = $state()` **deep-proxies any object assigned to it**. So
after `activeOption = filtered[0]`, `activeOption` is a Proxy *wrapping* the raw
option, and:

```js
filtered.includes(activeOption) // ALWAYS false — filtered holds the raw target, proxy !== target
activeOption === filtered[0]     // false
```

The reconciling effect was:

```js
$effect(() => {
  if ((activeOption && !filtered.includes(activeOption)) || (!activeOption && inputValue))
    [activeOption] = filtered   // activeOption = filtered[0]
})
```

`includes` is always false → the guard is always true → it reassigns
`activeOption` every cycle → `activeOption` changes identity → the effect
re-runs → infinite loop. It only triggers once `inputValue` is set (a search),
which is why it "freezes after the first search."

This is a **Svelte-4-store → Svelte-5-runes migration hazard**: with a plain
`let`/store the reference was preserved and `includes` worked; `$state` proxying
quietly broke it.

## Fix

Use **`$state.raw`** for state that holds a whole object *by reference* and is
only ever swapped wholesale (never mutated in place):

```js
let activeOption: SelectOption = $state.raw()
```

Now `activeOption === filtered[0]`, `includes` works, the effect converges.

## How it was found (debugging recipe)

Instrument the looping effect with a serialized `console.log` (objects log as
`JSHandle@object` under puppeteer — `JSON.stringify` them) and drive it headless
via the browser-tools `launch()` + dev-auth. The tell was:
`sameFiltered: true` (the array is the *same* memoized instance) yet
`filtered[0] === activeOption` was `false` *right after* assigning it — proving
the assigned value was proxied, not the raw element.

## Rule of thumb

If you keep a reference to an object that also lives in a plain (non-`$state`)
array/collection and you compare them with `===` / `.includes()` /
`.indexOf()` / `Set` membership, hold it in **`$state.raw`**, or compare by a
stable primitive key (e.g. `o.value`) instead of identity.
