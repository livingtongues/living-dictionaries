# Chat composer: paste image from clipboard → preview → send

Goal: in a chat room, when the message composer is focused, pasting an image from the
clipboard adds it as a pending attachment shown as a **thumbnail preview** (like horse web
input). Tapping the thumbnail opens a **full-screen viewer**. Sending uploads it (existing
`/api/chat/upload` pipeline). Images already render as thumbnails in *sent* messages.

## Decisions (confirmed with Jacob)
- Preview: image files → thumbnail tiles with hover ✕; non-image files → keep existing text chip. Mixed row.
- Paste consumes **images only**; pasted text/HTML still flows into the editor.
- **No resize** — upload raw; 20 MB per-file limit already guards (parity with paperclip picker).
- Tapping a pending thumbnail opens a full-screen image viewer.

## Existing infra (reused, not rebuilt)
- `RichTextEditor` already forwards an `on_paste` prop (TipTap `handlePaste`).
- `paste_image_from_clipboard(event)` util (already unit-tested) — pulls image File + preventDefaults.
- `StagedImageThumb` (svelte-pieces) — thumbnail + remove ✕. Used by compose-email-modal.
- compose-email-modal is the canonical staged-attachment + paste pattern to mirror.
- Composer send flow already uploads `files: File[]` via `/api/chat/upload`.

## Work
- [x] Add optional `on_view` prop to `StagedImageThumb.svelte` (opt-in tap-to-view; email modal unaffected).
- [x] New `image-lightbox.svelte` reusable full-screen viewer (portal + fade + Escape + backdrop button, mirrors Modal a11y).
- [x] `chat-composer.svelte`: switch internal `files: File[]` → `staged: {file, preview_url}[]`; add `handle_paste`; render thumbs (with `on_view`) + chips; open lightbox on view; revoke object URLs on remove/send/destroy; keep size/count validation; keep `on_send({files})` contract.
- [x] Stories: `image-lightbox.stories.ts`, `StagedImageThumb.stories.ts` (with/without on_view). Screenshot-verify.
- [x] Headless e2e on live LD dev server (`/tmp/chat-paste-e2e.mjs`): login as dev admin → synthetic PNG paste → 1 staged thumbnail (editor stayed EMPTY, so inline paste correctly suppressed) → tap → lightbox with image + close, **0 page errors**. Screenshots `/tmp/chat-paste-thumb.png`, `/tmp/chat-paste-lightbox.png`.
- [x] `pnpm check` both repos: **0 errors** (34 LD / 40 house pre-existing warnings, none in touched files). Lint: 0 errors (only the pre-existing `input` type-param warning in both composers).

## HOUSE
House chat composer was ALREADY doing paste→staged-thumbnail (it was ahead of LD). Only the
tap-to-fullscreen viewer was missing. Ported the identical `on_view` prop + `image-lightbox.svelte`
(house portal path `$lib/svelte-pieces/actions/portal`) + composer wiring. House chat lives at
`$lib/admin/chat/` (admin-only), RichTextEditor at `$lib/svelte-pieces/ui/RichTextEditor.svelte`.

## Notes
- portal is `$lib/svelte-pieces/portal` (LD) / `$lib/svelte-pieces/actions/portal` (house).
- Sent-message images still open in a new tab (out of scope); could later reuse the lightbox.
- Lightbox backdrop is `rgb(0 0 0 / 0.85)` (z-index 80, above header's z-index 2) — 15% see-through is intentional.
- StagedImageThumb is byte-identical across LD + house — the `on_view` addition was mirrored in both.
