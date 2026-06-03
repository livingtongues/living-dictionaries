# About page images — parity fix (corrected)

## The real problem
The three About photos rendered as squashed 690×**150px** slivers (default replaced-element
box) instead of their natural aspect ratio. Root cause: the `sizes="auto"` attribute on each
`<img>`. For auto-sizes lazy images the browser applies `contain: size`, which makes it IGNORE
the image's intrinsic dimensions and fall back to the 300×150 default. With `height: auto` there
is then no aspect ratio to derive from, so the height stays 150px — permanently (verified: it
does not recover even after scrolling the image into view).

## Why my first attempt failed
The original task assumed the fix was the CSS difference (bare `img {}` → `.about img {}`). I
ported that (`display:block; width:100%; height:auto`) — but it had no effect, because the
collapse is caused by `sizes="auto"`, not the CSS. The example repo was used as the "correct"
reference, but it ALSO has `sizes="auto"` + effectively identical CSS (`reset.css`:
`img,video { max-width:100%; height:auto }`), and its built `/about` even 404s — so its About
images were almost certainly never visually verified. The orchestrator inferred the fix from a
static diff without rendering it.

## What I changed (only `site/src/routes/about/+page.svelte`)
- Removed `sizes="auto"` from all three `<img>` tags (the actual fix → `contain: none`).
- Kept `loading="lazy"` (fine without `sizes`; good perf) and `srcset` (collapsed the Svelte-4
  baked-in newlines into a clean single line).
- Kept the image CSS at `display:block; width:100%; height:auto`.

## Verification (live dev server :3041, headless Chrome)
- All three images: `contain: none`, width 690px, heights 422/460/517 — each matching its
  natural aspect ratio (computed `ratioOK: true`). Screenshot confirms full photo, not a sliver.
- `pnpm --filter=site exec eslint --quiet src/routes/about/+page.svelte` → clean.
- `pnpm --filter=site check` → 0 errors, 62 warnings (baseline).
- No build run (concurrent session owns build/deps). Not committed.

## Note for follow-up
The example repo's About images likely have this same `sizes="auto"` collapse and should get the
same fix there.
