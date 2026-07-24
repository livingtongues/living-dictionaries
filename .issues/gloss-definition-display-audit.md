# Audit gloss vs definition display across UIs

From the Enxet import (2026-07-24): senses now commonly carry `definition`
WITHOUT `glosses` (11,935 Enxet entries: 11,699 gloss-only senses, 2,540
definition-only senses). Jacob: "audit how our different user interfaces show
those fields — we want both fields shown clearly and easily, especially in the
entries list."

## Surfaces to audit

- **Entries list** (`/{dict}/entries`) — the priority. Does a definition-only
  sense render anything in the list row / search result card, or does the row
  look empty? (Orama index too — is `definition` searchable?)
- Entry detail page — both fields visible/editable, clear labeling.
- Entry print/export views (print layout, CSV/export route).
- OG/share image (`/og`), homepage featured word cards.
- Anywhere else `glosses` is used as THE display string (grep for
  `glosses` usages that fall back to nothing).

## Test dictionary

`enxet` (unlisted) is a perfect live specimen — mixed gloss-only /
definition-only / empty senses (539 lexeme-only entries). Verify with
svelte-look stories + the deep-flow browser harness.
