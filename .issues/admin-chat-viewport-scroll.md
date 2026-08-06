# Bound admin chat to the viewport

The standalone `/chat` door owns a finite viewport-height workspace, but `/admin/chat` is mounted
inside an unbounded admin page. The message thread therefore grows with its contents instead of
becoming the internal scroll owner, making the composer require a long whole-page scroll.

## Plan

- [x] Compare the standalone and admin layout/overflow chains in Living Dictionaries and House.
- [x] Reproduce and measure the relevant element heights and scroll owners in a browser.
- [x] Make the admin shell a bounded flex column so chat receives the remaining viewport height.
- [x] Verify the shell/layout contract with computed browser assertions.
- [x] Run Svelte analysis, type/lint checks, and browser verification at desktop and phone sizes.

## Comparison notes

- Living Dictionaries standalone chat: `.chat-page.site` has an explicit viewport-derived height.
- Living Dictionaries admin chat: `.chat-page.admin` expects a bounded flex parent, but the current
  admin `.page` uses only `min-height: 100vh` and `.page-main` is an ordinary block.
- House admin and team shells already use the intended bounded chain: `.page { height: 100vh;
  display: flex; flex-direction: column; overflow: hidden }`, then a flex-column main with
  `min-height: 0; overflow: auto`.

## Before-fix browser evidence (1280 × 720)

- Standalone `/chat`: document 720px; thread client height 430px vs scroll height 1,916px.
- Admin `/admin/chat`: document 2,227px; thread client height grew to its full 1,916px content.
- House `/admin/chat`: document 720px; bounded thread client height 400px.

## Verification

- After the fix at 1280 × 720: document 720px; admin main 663px; message thread 409px client
  height vs 1,916px scroll height.
- Scroll interaction: moving the thread from bottom (`scrollTop=1507`) to top (`0`) and back left
  page `scrollY=0` and the composer at the same 513px viewport position throughout.
- At 390 × 844: document 844px; thread 533px client height vs 2,348px scroll height; composer fully
  visible at the bottom.
- Visually inspected desktop and phone screenshots in light mode.
- Svelte analyzer: no issues.
- `pnpm check`: 0 errors (48 pre-existing warnings).
- `pnpm lint`: passed.
- `pnpm test --run`: 343 files passed, 1 skipped; 2,572 tests passed, 4 skipped.
- `pnpm build`: passed (pre-existing Svelte warnings only).
