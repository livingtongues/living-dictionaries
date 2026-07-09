# Chart improvements ported from FlareCharts / LayerChart ideas

Source: reviewed https://flarecharts.gitbook.io/ and https://www.layerchart.com/llms.txt.
Both are Svelte 5 + SVG + d3-for-math-only + CSS-var theming — same architecture as ours.
Not installing either; copying **features** we lack. LineChart.svelte + ComboChart.svelte are
**byte-identical** between LD and house — implement in LD, verify, copy to house verbatim.

## Scope (Jacob's picks)
- ✅ #2 Keyboard-driven hover on Line/Combo (←/→ step points, Home/End jump, Esc clear)
- ✅ #3 Legend series toggle on ComboChart (real buttons, aria-pressed, click to hide/show)
- ✅ #4 Container-responsive chrome-shedding (fewer ticks + legible font on narrow widths)
- ❌ NOT doing: #1 a11y data table, #5 reduced-motion guards, #6 mount animations

## Verify
svelte-look stories + screenshots per chart, both repos. Add a narrow viewport to stories to
exercise #4. Add an interaction story that focuses the svg + presses ArrowRight for #2.

## Files
- site/src/lib/charts/LineChart.svelte  (#2, #4)
- site/src/lib/charts/ComboChart.svelte (#2, #3, #4)
- + house/site/src/lib/charts/{LineChart,ComboChart}.svelte (copy verbatim after LD verified)
- stories: LineChart.stories.ts, ComboChart.stories.ts (both repos)

## Progress
- ✅ LineChart #2 keyboard (←/→/↑/↓/Home/End/Esc, tabindex + focus-visible ring, drives existing hover)
- ✅ LineChart #4 responsive (x-tick count 3/4/6 via bind:clientWidth on .wrap)
- ✅ ComboChart #2 keyboard (steps union of visible-series dates; set_hover extracted from on_move)
- ✅ ComboChart #3 legend toggle (legend entries → real <button aria-pressed>, hidden{} filters `visible`)
- ✅ ComboChart #4 responsive (x-tick count 3/4/7)
- ✅ Screenshots verified (LD, light+dark, wide+380px narrow)
- ✅ Copied to house + verified (byte-identical; house svelte-look CLI)

## Notes / decisions
- Dropped the axis-font-size bump idea: with a fixed viewBox the left gutter (m.l) scales too,
  so a bigger "400000" y-label overflowed the gutter and clipped ("0000"). The libraries SHED
  chrome (fewer ticks) rather than resize fonts on narrow — matched that. Tick reduction is the
  real win (prevents date-label collision).
- Legend toggle keeps the x-domain stable when a series is hidden (only y-domain + drawn lines +
  tooltip recompute) so the chart doesn't jump.
- No Map/Set for kb_points dedupe — eslint `svelte/prefer-svelte-reactivity` flags built-in Map;
  used a plain Record + array instead.
- svelte-look interaction: focus an <svg> via `page.evaluate(() => svg.focus())`, NOT
  `page.focus('svg')` (puppeteer: "Cannot focus non-HTMLElement").
- Did NOT do #1 a11y data table, #5 reduced-motion guards, #6 mount animations (out of scope).
  a11y is still the biggest remaining gap if revisited later.
