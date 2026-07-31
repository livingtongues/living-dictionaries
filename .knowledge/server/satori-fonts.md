# satori: fonts, scripts and the traps that are invisible from the code

Facts about **satori 0.26** + `@shuding/opentype.js` + the Google Fonts CSS API that you cannot
learn by reading house's code, and that cost a day of tofu share cards on 2026-07-30.

Read this before touching `src/routes/og/` or before bumping satori in ANY of the three apps.

## The one-line lesson

**A broken font is not an error.** Every failure mode below returns HTTP 200, a valid font file, a
valid PNG, and no exception. The card is wrong and everything reports success — which is why the
2026-07-30 log review read "no recurrence" as "fixed" when it actually meant "we stopped throwing."
Never conclude a font problem is solved from the absence of error rows. Render it and look at it.

## Script codes are version-specific — and can name several scripts at once

satori calls `loadAdditionalAsset(code, text)` with its own code for the run's script. **The code
vocabulary changed between 0.0.44 and 0.26**, which is the whole bug:

| | satori 0.0.44 (Living Dictionaries pins this) | satori 0.26 (house) |
|---|---|---|
| Hebrew | `he` | `he-IL` |
| Japanese | `ja` | `ja-JP` |
| Chinese | `zh` | `zh-CN` / `zh-TW` / `zh-HK` |

Porting a map across that boundary silently kills every key.

**Less obvious, and not in any docs**: satori returns ALL matching scripts joined by `|`
(`va(word, locale).join('|')` in the bundle). So Han text arrives as
**`ja-JP|zh-CN|zh-TW|zh-HK`** — a map keyed on a bare `zh-CN` never matches Chinese either. Split
on `|`, and prefer returning an ARRAY of fonts (satori's `loadAdditionalAsset` accepts one) so its
own per-glyph fallback picks between the four Han faces rather than you guessing.

Measured against the installed 0.26:

| text | code |
|---|---|
| `מַלְאָך` | `he-IL` |
| `聖書` | `ja-JP\|zh-CN\|zh-TW\|zh-HK` |
| `ひらがな` | `ja-JP` |
| `한국어` | `ko-KR` |
| `λόγος` | **`unknown`** — satori has no Greek regex |
| `🔥`, `✝️` | `emoji`, one call **per grapheme** |
| `∑` | `symbol` (checked before `math`) |

Greek arriving as `unknown` is why a broken map still looked fine for Greek: base Noto Sans covers
it. Don't take a working Greek card as evidence of anything.

## satori caches its FontLoader by the IDENTITY of `options.fonts`

```js
Is.has(e.fonts) ? r = Is.get(e.fonts) : Is.set(e.fonts, r = new ir(e.fonts))
```

A WeakMap keyed on the array object, and `loadAdditionalAsset` results are `addFonts`-ed into it.
Two consequences that were live in house's production for two days:

1. **A "retry with static fonts only" that reuses the same array is a no-op** — it re-renders
   against the loader that was just handed the font that threw. Measured: an Arabic card failed,
   retried, failed identically with the same stack.
2. **Every dynamic font ever fetched accumulates in that one loader** for the life of the process,
   and one unparseable face poisons later renders whose text needs fallback.

Build a **fresh `fonts` array per satori call**. It costs nothing — the parsed font is cached
separately, keyed by the data buffer.

## `@shuding/opentype.js` cannot parse Noto Arabic

Every Noto Arabic face throws `lookupType: 5 - substFormat: 3 is not yet supported` from
`arabicRequiredLigatures` while shaping. Verified 2026-07-31 across **Noto Sans Arabic, Noto Naskh
Arabic, Noto Kufi Arabic and Amiri**. **Cairo, Tajawal and Markazi Text parse fine.**

A face that throws is worse than no face: it costs the whole render, not just the glyphs. Any new
script added to a font map should be rendered once and looked at before it ships.

## Google Fonts CSS API quirks

- **It answers 200 for a family that cannot draw the text.** `?family=Noto+Sans&text=<hebrew>`
  returns a real, parseable TTF with no Hebrew in it (~1,664 bytes — roughly the empty-subset
  floor). This is the mechanism by which an `unknown` fallback produces silent tofu.
- **…but the font FILE it points at can 400.** For Noto Sans + Hebrew the CSS parses and the
  follow-up fetch of the `src: url(…)` returns **400**. Guard and report that leg separately; a
  bare `return` there is a second silent path.
- **Colour emoji is not subsettable.** `Noto+Color+Emoji&text=🔥` returns the full **20 MB** file
  (vs 1.5 KB for monochrome `Noto+Emoji`), and its CBDT/COLR bitmap strikes aren't drawable by this
  parser anyway. Use `Noto+Emoji` for a text-shaped emoji, or return a data-URL image string from
  `loadAdditionalAsset` (satori treats a string return as a grapheme image) if colour is required.

## How to verify a font change, properly

1. Ask the INSTALLED library what codes it emits — render sample text with a `loadAdditionalAsset`
   that just records its arguments. Never trust a docs page or a sibling repo.
   (`site/src/lib/server/satori/font-map.test.ts` does exactly this and is the regression guard.)
2. Render probe cards through the real worker and **look at the PNGs**.
3. Render the same card with the OLD map to confirm the difference is causal — environment
   differences will otherwise fool you.

## Cross-repo status

- **Living Dictionaries** — satori **0.29.0** since 2026-07-31
  (`.issues/satori-upgrade-and-font-map-safety-net.md`). Was on 0.0.44 for two and a half years.
- **house** — satori **0.26.0**. Its script codes are IDENTICAL to 0.29's (both probed), so
  `font-map.ts`, `families_for_script` and the pinning test are the same file in both repos.

## What the 0.0.44 → 0.29 jump actually changed, visually

Ten representative cards rendered through the real worker before and after, then diffed pixel by
pixel: **layout is identical.** 0.5–4.2% of subpixels differ and the difference map shows the
change is confined to text glyph EDGES — sub-pixel rasterization from the new yoga/text layout, not
reflow. Line breaks, wrapping, the clipped description, the footer position and the inline
`SvgGlobe` (which renders byte-identically) are all unchanged. Don't fear the layout on this jump;
fear the font map.
