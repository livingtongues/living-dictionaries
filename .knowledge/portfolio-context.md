# Portfolio context — Living Dictionaries

> Jacob's priorities, in his words. This is the business frame for any "what should I
> work on / nudge Jacob about" loop — **use this instead of guessing from git history.**
> Last dictated: 2026-07.

## What winning looks like (6–12 months)

**The language-documentation flywheel** turning smoothly. Roughly: inputted audio → generic TTS
→ force-aligned → guessed entries → user cleans up → pipeline to fine-tune TTS → more audio flows
in → transcribed with a **language-specific** TTS → more entries and sentences → auto-glossing
entries in texts gets faster → … Building a **quality corpus becomes very easy**, and the data is
**easily pipeable into training models for STT, TTS, and machine translation.**

> Jacob has the full details written up elsewhere and will share them — **don't try to flesh out
> the flywheel from this summary; just call it "the language documentation flywheel."**

## This quarter's flight path

1. **Make the AI-agent story great** — so people can better **access, analyze, and improve their
   data**.
2. **Smooth the full pipeline:** **texts → sentences → entries.**

## Non-negotiables (a regression here is a fire)

- **Keep bugs out and keep performance good** (portfolio-wide — see below).

---

## Portfolio-wide (applies to house, tutor, and living-dictionaries)

**Top priority right now across all products: keep bugs out and keep performance good.**
Writing code and shipping features has become easy with agents — the real constraint is
**catching problems early and fast.**

**Aspiration (not yet designed):** a post-deploy **error-burst detector** — for some window
after a push, if errors start piling up, auto-spawn a **triage agent** to debug immediately, so
fixing an error takes **5 minutes to an hour** (fix it when Jacob's back at his machine or sees
the phone notification) instead of half a day of waiting for the next log dump.

- **Blocker / open question:** error *noise*. Browsers throw a lot of junk. Before auto-triage
  is sustainable we need to separate real errors from noise — either get better at **categorizing
  known browser errors** (log them differently) or otherwise manage the noise floor. Managing it
  must **not** just mean turning error reporting off. Jacob doesn't know the current noise level
  or the exact mechanism yet — this needs design before it's built, or it'll drown in false positives.
