# /home-preview polish pass

Multi-part tweak batch for the homepage v2 preview. Tracking here.

## Status: ✅ all done (2026-07-06) — verified via unit tests, `pnpm check`, eslint,
svelte-look stories, and headless puppeteer on the live dev map (desktop + mobile).

## Tasks

### 1. Dictionaries stat = public + unlisted (build-time)
- `compute_homepage_stats` currently: `dictionaries = COUNT(*)` all dicts (~2232).
- Change to count **public + unlisted** only. Also bake a separate **public-only**
  count for the footer.
- Plan: add `public_dictionaries` (public col = 1) and make `dictionaries` =
  public + unlisted (bucket='unlisted'). Both baked into homepage-baked.json.
- Display: exact number + "+" (e.g. "617+"), NOT floored to tens (per Jacob).
  → remove 'dictionaries' from TENS_STATS / special-case it as exact+"+".

### 2. Footer counts (baked, not live)
- Footer public dictionaries count → baked build-time **public** count.
- Footer entries count → baked entries rounded to nearest hundred, matching the
  home-preview cube ("555,000+", incl "+"). Currently hardcoded 254813.
- Footer is shared shell; import homepage-baked.json directly.

### 3. AgentApiDiagram ("Turn archives into living data") → admin level 3 only
- Gate on `page.data.auth_user?.admin_level >= 3` in +page.svelte.

### 4. Card image tap → fullscreen viewer
- Tapping a word card image opens a fullscreen image (like the glossary
  Image.svelte viewer) with overlaid: dict name, audio button, Open entry button.
- No dictionary download until Open entry is tapped (preload=tap on that link only).

### 5. Map adjustments (WorldMap.svelte)
- Remove wheel/scroll zoom entirely (+ remove wheel hint).
- Hide zoom controls when fully zoomed out (k≈1); show when zoomed in.
- Mobile: map full-bleed to screen edge (remove padding/radius ≤640px).
- Trim Antarctica (projection latitude clamp; affects SSR + canvas).
- Initial click: clicking a country landmass OR a cluster dot → zoom to country
  level (fit clicked country bounds). Individual single dot → current popover.

### 6. Mobile: only one red connector line at a time (HeroUnit)
- On mobile, only the centered card draws a line to its dot.

## Notes / discoveries
- admin level: `page.data.auth_user.admin_level` (EffectiveAdminLevel 0-3).
- bucket values: 'public','unlisted','secure','conlang','glossary','delete' (NULL=unclassified).
- Local shared.db has no buckets set (all NULL); prod has them. Public col local=220.
</content>
