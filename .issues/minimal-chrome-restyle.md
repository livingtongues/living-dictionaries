# Minimal-chrome restyle pass (split from ui-skill-alignment phase 5)

The 2026-06-12 uno drop was a pixel-parity port; the mechanical alignment lane
(FA kit → `~icons`, `icons.css` shim retirement, `ui/Button.svelte` → HeadlessButton + `.btn-*`)
finished 2026-07-12. This is the remaining **deliberate restyle** — taste work, route-by-route
with Jacob's eyeball, not parity work. Read `.claude/skills/svelte-ui/SKILL.md` first — it IS
the spec (minimal chrome, surface-based hierarchy, invisible inputs).

## Scope

1. **Surface-based hierarchy**: replace gratuitous borders/dividers with `--surface` vs
   `--background` shifts; cards per the skill recipe (no border, 0.75rem radius, press-scale);
   generous spacing values from the skill.
2. **Named theme vars**: promote recurring `color-mix` recipes from the parity conversion into
   named vars in theme.css — the conversion log flagged gray-700/600/400 mixes recurring widely.
3. **btn-primary demotion audit** (the design half of the button migration): Jacob wants only
   1-2 `btn-primary` CTAs per page, everything else ghost/plain. Current density post-codemod:
   69 `btn-primary` across 57 files (~1.2/file) — near target already, but nobody has done a
   page-by-page pass demoting non-primary actions to `btn-ghost`/plain `btn`. Jacob's stated
   taste: "I really like the clean look of buttons without any background or border, just a
   slight hover change."
4. **Biggest legacy surfaces to hit**: entries table + filters, entry editor modals, settings
   forms, contributors/export/import pages, home search.
5. **Grow svelte-look coverage as you go**: each restyled component/route gains a story so
   verification (and dark-mode audits) stays cheap.

## Baseline (2026-07-12 post-button/icon-migration sweep)

Full light + dark sweeps ran clean at `/tmp/post-button-sweep/{light,dark}` — no visual
regressions from the Button→HeadlessButton codemod or the FA-kit/icon-shim retirement, zero page
errors (the lone "Event" pageerror was an uncaught GSI script-load rejection in AuthModal —
fixed). Audit example spotted for item 3: `/[dict]/contributors` stacks FOUR `btn-primary`
buttons (Invite a Manager / Invite Contributors / Write in Contributor / Write in Partner Org).
Note: the sweep script's `?view=` URLs were stale — views live inside the `?q=` JSON param
(fixed in `site/e2e/uno-parity-shots.mjs`, which now also tags page errors with the shot name).

## Verification

- svelte-look stories per component; `site/e2e/uno-parity-shots.mjs` for whole-app sweeps
  (light + `DARK=1`); Jacob reviews per batch — this lane does NOT ship without his eyeball.

Sibling: house's equivalent is `~/code/house/.issues/future/post-parity-styling-improvements.md`.
