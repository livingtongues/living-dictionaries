# Email components — cross-repo parity manifest

These Svelte email primitives are copy-paste-shared across **tutor**, **house**, and
**living-dictionaries** (`site/src/routes/api/email/components/` in each repo — this file is
kept identical in all three). They are NOT byte-identical on purpose: use this manifest to tell
accidental drift from intentional forks before porting a fix across repos.

The render/send seam lives in `$lib/email/` in every app:

- `render-component-to-html.ts` — Svelte SSR → email-safe full HTML document (style-tag merge,
  sourcemap/hydration-comment stripping). Same shape in all three; house's
  `render-component-to-html.test.ts` + fixture are ported to the siblings.
- `send-email.ts` — the **transactional lane**: simple SES `SendEmailCommand`, one recipient per
  send, 7/sec throttle. house + LD accept multipart `{ html, text }` bodies; tutor is still
  single-string + `type`.
- `send-raw-email.ts` — the **thread lane**: raw MIME for message-thread replies with
  `In-Reply-To`/`References` threading and attachments. Never use it for simple notices.

## Must stay identical (all three)

- `DarkModeSupport.svelte` — byte-identical today; keep it that way.
- `client-specific-styles.css` — house + LD share the file byte-identical (imported
  `?inline` in `Head.svelte`); tutor inlines the SAME css text directly inside its `Head.svelte`
  (tutor's `email-client-specific-styles.css` file is an unused duplicate of the same text).

## Structurally shared — port fixes, expect benign drift

`Body`, `CallToActionButton`, `DashedLine`, `Footer`, `Head`, `Header`, `Html`, `Image`, `Link`,
`Paragraph`, `Preview`, `Row`, `Shell`, `Title`, `TrackingPixel`, `markdown/MarkdownToEmailHtml`,
`markdown/RenderToken` (markdown/ exists in tutor + house only).

**`Preview.svelte` (the hidden inbox preheader) is byte-identical in house + tutor and
`const`-drift-only in LD — keep it that way.** Two things about it are load-bearing (both landed
2026-07-29, house-first): the whitespace filler is `repeat(Math.max(0, 150 - text.length))`
because a bare `150 - length` throws a `RangeError` on any preheader over 150 chars, and an EMPTY
`preview` renders NOTHING at all (the client then shows the start of the body copy — the normal
default, and better than repeating the subject line, which is what house's newsletters/automations
used to do before they grew their own `preheader` column).

**Any email component with a `<style>` block MUST carry `<svelte:options css="injected" />`** —
without it Svelte SSR emits only the class names and the styles (all the mobile media queries)
silently never reach the sent email. house + LD shipped that way until 2026-07-29; tutor had it
from the start.

Benign drift that is NOT a fork (flatten freely when touching a file):

- LD destructures `$props()` with `const ... =`; house/tutor mostly use `let ... =`.
- house + LD still carry `// @ts-nocheck` in `Body`/`CallToActionButton`/`Image`/`Row`/
  `TrackingPixel` — legacy debt, remove when touched.
- Minor whitespace/quote-style differences (e.g. `Body.svelte` fontFamily quoting).

## Intentional forks (NEVER flatten)

- **tutor** — localization: `language?: LanguageCode` prop threaded `Shell → Html`
  (`@tutor/shared/i18n`); `Footer` takes a tokenized `unsubscribe_url`; `Image.href` optional;
  `Row` adds `x_padding`; several components use `<svelte:options css="injected" />`.
- **house** — `Footer` renders the hvsb.app account-settings unsubscribe copy
  (`show_unsubscribe`); `markdown/` adds `wrap_link` (per-recipient click-tracking rewrite) and
  `standalone-link.ts` (standalone link paragraph → CTA button) for newsletters/automations;
  `Row` adds `cell_class` (outer-td class for `<style>`-block overrides — the masthead's mobile
  edge-to-edge query lives in `Header`);
  `Header` takes a `banner_url` that REPLACES the brand-colored bar with the baked masthead photo
  (`/api/email/header-image/<id>` — photo + wordmark burned into one JPEG by satori/resvg, because
  live text over a background image is not portable in Outlook). Every house-branded email passes
  one. Port it only alongside that endpoint + an image pool to feed it.
- **living-dictionaries** — `Body.svelte` deliberately omits the `<tbody>` wrapper
  (email-client typography); `CallToActionButton`/`Footer` markup restructured; brand copy is
  Living Tongues Institute / Living Dictionaries.

## App-specific components (no counterpart — don't port)

- house: `Newsletter.svelte`, `OtpEmail.svelte`
- living-dictionaries: `BaseLayout.svelte`, `MessageReply.svelte`
- tutor: none beyond the shared set (welcome/newsletter emails compose the primitives in
  `routes/api/email/new-user/` + `routes/api/email/newsletter/`)
