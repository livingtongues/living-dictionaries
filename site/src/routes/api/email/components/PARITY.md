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
  `standalone-link.ts` (standalone link paragraph → CTA button) for newsletters/automations.
- **living-dictionaries** — `Body.svelte` deliberately omits the `<tbody>` wrapper
  (email-client typography); `CallToActionButton`/`Footer` markup restructured; brand copy is
  Living Tongues Institute / Living Dictionaries.

## App-specific components (no counterpart — don't port)

- house: `Newsletter.svelte`, `OtpEmail.svelte`
- living-dictionaries: `BaseLayout.svelte`, `MessageReply.svelte`
- tutor: none beyond the shared set (welcome/newsletter emails compose the primitives in
  `routes/api/email/new-user/` + `routes/api/email/newsletter/`)
