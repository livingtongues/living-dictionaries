# A plain `?q=word` search link is silently discarded, and `QueryParamState` instances leak

Found by the 2026-07-31 nightly log review: **77 `malformed_query_param` warnings** in 24 hours,
every one for the key `q`, from 3 sessions. The logged raw values are ordinary searches —
`birthday`, `santa`, `sant`, `san`.

Two distinct problems produce that one warning.

## 1. The entries view throws away a human-shaped search URL

`routes/[dictionaryId]/entries/+page.ts` registers `q` as a **JSON object**:

```ts
const search_params = new QueryParamState({
  key: 'q',
  startWith: { page: 1, query: '' },   // ← an object
  cleanFalseValues: true,
})
```

`QueryParamState.#set_state_value` (`lib/state/query-param-state.svelte.ts:132`) sees a URL value
that is a plain string where it expected an object, logs `malformed_query_param`, and then:

```ts
parsed_value = {}
```

So `https://livingdictionaries.app/garifuna/entries?q=birthday` opens the **unfiltered** entry list
with an **empty** search box. The searcher's intent is dropped with no message.

That URL is not hypothetical — it is what a person guesses, what an LLM or agent constructs, and
what could plausibly be indexed. Two of tonight's three sessions arrived that way (both automation,
`webdriver: true`, on `/garifuna/entries?q=birthday`), but the shape is exactly what a human would
type.

The canonical form is `?q={"page":1,"query":"birthday"}` and there is already a helper that builds
it — `lib/search/entries-query-link.ts` `entries_query_href()` — used for agent-generated links.

### Fix

- [ ] In `#set_state_value`, when `start_with` is an object and the URL value is a **non-empty
      string that is not JSON**, treat it as `{ query: value, page: 1 }` rather than `{}`. This is
      the only string-typed facet, so the mapping is unambiguous.
- [ ] Only warn when the value is genuinely unusable (JSON that parses to a non-object, e.g.
      `?q=[1,2]`). A working, guessable URL must not log a warning.
- [ ] Optionally normalise the URL to the canonical JSON form afterwards, so a shared link
      round-trips.
- [ ] Test both directions in `query-param-state.svelte.test.ts`: `?q=birthday` fills the search
      box; `?q={"query":"birthday"}` still works.

## 2. `QueryParamState` instances are never destroyed and keep reacting to unrelated routes

The other 5 warnings came from **`/admin/dictionaries?q=santa`** — a page that has nothing to do
with the entries view and manages its own `q` as a plain string
(`routes/admin/dictionaries/+page.svelte:89`). The raw values progressed `san` → `sant` → `santa`,
i.e. one warning per keystroke as an admin typed.

Cause: the constructor opens a permanent subscription,

```ts
this.#dispose = $effect.root(() => {
  $effect(() => { this.#handle_search_params(page.url.searchParams) })
  …
})
```

and `destroy()` — which would call `#dispose` — is **never called anywhere in application code**
(only in `query-param-state.svelte.test.ts`). The instance created by `+page.ts` `load()` on
`/{dict}/entries` therefore lives for the whole tab session and keeps evaluating every subsequent
URL, on every route, forever. Each fresh visit to an entries page adds another one.

Today it is only noisy: `#set_state_value` sets `#applying_url_value` before assigning, so the write
effect sees `value === state_value` and does not clobber the admin's search param. That is a
coincidence of ordering, not a guarantee.

### Fix

- [ ] Tear the instance down when its page is left. Options, in order of preference:
      (a) create it in `+page.svelte` with `$effect(() => () => search_params.destroy())` instead of
      in `load()`; (b) keep it in `load()` but have the page component own the teardown;
      (c) make `#handle_search_params` a no-op when `page.route.id` no longer matches the route that
      created the instance.
- [ ] Add a test that navigating away stops the instance reacting to URL changes.

## Why this is worth doing together

Both halves are the same underlying assumption — *this key on this page is always my object* — and
the warning that exposed them fires on both. Fixing only the first leaves per-keystroke noise from a
leaked subscription; fixing only the second leaves shared search links broken.
