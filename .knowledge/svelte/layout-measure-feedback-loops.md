# Layout measure→style feedback loops (rows that quiver forever)

**Rule: never take a `bind:clientHeight` / `bind:clientWidth` / ResizeObserver reading of an
element and feed it back into that same element's own layout.** Svelte re-runs the effect on
every measurement change, so if the resulting style can change the measurement you get an
infinite 60fps layout loop. It doesn't look like a bug in code review — it looks like a clever
way to do what CSS "can't".

Real case (entries list, `ListEntry.svelte`, shipped 2026-07-24, fixed 2026-07-28): the row
measured its own height and used it to (a) pick a full-bleed vs floating media rail at a 104px
threshold, and (b) set the flush thumbnail's width. Rows whose photo thumb was **taller than
wide** oscillated 104px ⇄ 127px forever — visible as the top rows of the Iquito list vibrating.
Full write-up: `.issues/entries-list-row-quiver.md`.

## The three couplings to look for

1. **Intrinsic aspect leaking upward.** `<img width:100%; height:100%>` inside a box with only a
   definite width still contributes `width × natural_h/natural_w` to the parent's intrinsic
   height. Kill it by taking the image out of flow (`position: absolute; inset: 0`) — then the
   image can never grow its ancestors.
2. **A mode switch that changes the measured dimension.** If mode A makes the row 127 tall and
   mode B makes it 104, and the threshold sits between them, it will flip every frame.
3. **A mode switch that changes a sibling's width.** Even with heights pinned, a rail that is
   104px wide in one mode and 88px in the other changes the text column's wrap points → changes
   the row height → flips the mode. Give the slot a FIXED width in both modes.

## The pattern that replaced it

Wrap the variable part in a fixed-width `container-type: size` element and switch looks with
`@container (height > …)`. Size containment means nothing inside can influence the row's height,
and the fixed width means nothing inside can influence the text's wrapping — the query is a pure
one-way read of a height that only the text controls. A container can't style *itself*, so the
wrapper must be an extra element around the thing you want to restyle.

`container-type: size` works fine on a flex item with `align-self: stretch` (its cross size is
definite), and the negative-margin trick for bleeding past the parent's padding still works.

## Detecting it (the check that proves a fix)

Screenshots can't see a quiver. Sample across animation frames instead and flag any element with
more than one distinct height:

```js
const readings = rows.map(() => [])
for (let i = 0; i < 60; i++) {
  await new Promise(r => requestAnimationFrame(r))
  rows.forEach((row, index) => readings[index].push(row.getBoundingClientRect().height))
}
// any row with >1 distinct value is looping
```

Run it in puppeteer against the real page — and read
`testing/index.md` first: a `HeadlessChrome` user-agent is treated as a robot in production and
the dictionary database never boots, so set a real browser UA.
