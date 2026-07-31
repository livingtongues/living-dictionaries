# satori 0.0.44 → 0.29, with the font-map safety net that makes it survivable

**Done 2026-07-31. Approved by Jacob** (option B: port the safety net AND upgrade in the same pass)
after the house incident in `~/code/house/.issues/og-font-map-keys-dead-on-satori-0.26.md`.

## Why this was urgent rather than housekeeping

satori **renamed every script code** between 0.0.44 (`he`, `ja`, `zh`) and 0.26+ (`he-IL`,
`ja-JP`, `zh-CN`). house crossed that boundary on 2026-07-30 by copy-porting THIS repo's map onto
satori 0.26, and every Hebrew and CJK share card rendered as tofu boxes for a day — silently,
because Google Fonts answers 200 with a real, parseable font that simply has none of the requested
glyphs.

LD's card surface is overwhelmingly non-Latin. Upgrading here without fixing the map first would
have been that outage across nearly every card. The map fix had to land in the same commit as the
bump, and the test had to land with it.

## Two bugs that were ALREADY live on 0.0.44

Found while establishing a baseline, not caused by the upgrade:

1. **Arabic dictionaries were serving the GENERIC card, not a tofu one.** `@shuding/opentype.js`
   throws `lookupType: 5 - substFormat: 3 is not yet supported` on the required-ligature table of
   **every** Noto Arabic face. The `static_fonts_only` retry was supposed to absorb that — it
   couldn't (see below) — so the render failed outright and the route fell back to the generic
   card. This is the 1,486 daily font failures from one Arabic-script dictionary in the 2026-07-29
   review, and it was never just a cosmetic fault.
2. **Emoji headwords rendered as tofu.** `emoji` is a code satori has always emitted; the map had
   no key for it.

## The retry has never once run with static fonts only

satori caches its FontLoader in a WeakMap keyed by the **identity of `options.fonts`**:

```js
Is.has(e.fonts) ? r = Is.get(e.fonts) : Is.set(e.fonts, r = new ir(e.fonts))
```

`loadAdditionalAsset` results are `addFonts`-ed into that loader. `render-worker.js` built
`base_options` once and passed the same array to both the attempt and the retry, so the retry
re-rendered against the loader that had just been handed the font that threw. Measured: identical
failure, identical stack. Second consequence: **every dynamic font ever fetched accumulated in one
loader for the life of the worker.**

Fixed with `fresh_options()` — a new array per satori call. Costs nothing (the parsed font is
cached separately, by data buffer). Covered by a test that fails on the old code.

## What landed

| file | change |
|---|---|
| `site/package.json` | satori `^0.0.44` → `^0.29.0`, satori-html `^0.3.0` → `^0.3.2`, @resvg/resvg-js `^2.2.0` → `^2.6.2` |
| `src/routes/og/font-map.ts` | **new** — the map as typed DATA, riding into the worker via `workerData` |
| `src/routes/og/font-map.test.ts` | **new** — pins the keys to the INSTALLED satori by rendering real text through it |
| `src/routes/og/render-worker.js` | `families_for()` (splits `\|`), a warn on every no-font path, parallel multi-family fetch returning an ARRAY, `fresh_options()` |
| `src/routes/og/component-to-png.ts` | passes `LANGUAGE_FONT_MAP` in `worker_data` |
| `src/routes/og/render-worker.test.ts` | multi-script regression + the font-parse-failure regression |
| `SeoMetaTags.svelte` / `card-store.ts` | `OG_IMAGE_VERSION` 6 → 7, `STORE_FORMAT` 1 → 2 |

Two things the house diagnosis got wrong, which this map handles:

- **satori joins every matching script with `|`.** Han text arrives as `ja-JP|zh-CN|zh-TW|zh-HK`, so
  a map keyed on a bare `zh-CN` never matches Chinese. `families_for_script` splits, keeps every
  family the parts name, and the loader returns them ALL — satori falls back per glyph, so nobody
  has to decide whether 聖 meant Japanese or Chinese.
- **Arabic maps to `Cairo`**, not Noto. A face that throws is worse than no face: it costs the whole
  card, not just the glyphs. (Cairo, Tajawal and Markazi Text parse; Noto Sans/Naskh/Kufi Arabic and
  Amiri do not.)

## Verification

Ten representative cards were rendered through the REAL worker **before** the upgrade and again
after, then compared pixel by pixel (`/tmp/ld-og/before` vs `/tmp/ld-og/after`).

| card | before | after |
|---|---|---|
| plain · globe · photo+globe · long · hebrew · devanagari · cjk | fine | **identical layout**, 0.5–4.2% of subpixels differ and the difference map shows it is ONLY text glyph edges — sub-pixel rasterization, not layout. `SvgGlobe` renders byte-identically. |
| **thai** | fine on 0.0.44's `th` key — would have gone tofu on 0.29 without the map fix | fine |
| **arabic** | **RENDER FAILED** → generic card | renders, correctly shaped and RTL |
| **emoji** | **tofu boxes** | real glyphs |

Then: `pnpm lint` clean · `pnpm check` **0 errors** · `pnpm --filter site test` **2,395 passed** ·
`pnpm build` succeeds.

Docker runtime checked too, since the runner does `pnpm install --prod --ignore-scripts`:
satori's new `yoga-layout@3.2.1` dependency ships prebuilt and has no install script, and
`@resvg/resvg-js-linux-x64-musl@2.6.2` is in the lockfile for the alpine runner.

## Follow-ups (not done, deliberately)

- `OpenGraphImage.svelte` guards the globe with `{#if lat && lng}`, so a dictionary at **lat 0 or
  lng 0** (the Gulf of Guinea, but also any row with a zeroed coordinate) silently loses its globe.
  Should be a `!= null` check. Noticed while building the emoji probe card; not touched here because
  it is unrelated to the upgrade.
- house is still on satori **0.26.0**. The script codes are identical to 0.29's (verified by
  probing both), so the font map, the resolver and the test are the same file in both repos and the
  divergence costs nothing today. Worth aligning next time house's `/og` is opened.
