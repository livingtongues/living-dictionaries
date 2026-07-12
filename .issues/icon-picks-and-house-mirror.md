# Icon-review picks + house button/icon mirror (alignment-lane leftovers)

Remaining open items from the completed `ui-skill-alignment` lane (2026-07-12).

## 1. Apply Jacob's glyph picks — ⏳ WAITING ON JACOB

The FA **Pro 5.15.4** kit is gone; 14 ex-Pro-regular glyphs provisionally use `~icons/fa-solid`
(info-circle, donate, times, bars, sign-in-alt, key, undo, spinner, pencil-alt, link, language,
film, upload, check). `/admin/icon-review` (level 3) shows Pro original (page injects the kit
itself) vs provisional fa-solid vs mdi-outline with tap-select.

- Jacob taps picks (designed flow: on prod after next deploy), screenshots/submits back
- Apply picks across call sites
- **DELETE the `/admin/icon-review` page** once applied

## 2. Mirror the button migration to house

house has ~13 `ui/Button.svelte` imports. Repeat LD's migration there with the same variant map
(`form="filled"` → `.btn-primary`, `text|simple|menu` → ghost/plain, size/color mapping — see
LD git history around 2026-07-12, codemod was /tmp/button-codemod.mjs, rewritable from the LD
diff). house also still has its own icon-shim/`svelte-pieces` remnants — check its
`post-parity-styling-improvements.md` before starting so the two lanes don't collide.
