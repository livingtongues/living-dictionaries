# Outside-the-app boot-error reporter (port from tutor)

**Cluster 2** of the 2026-08-05 debrief, coordinated from
`~/code/horse/.issues/outside-boot-reporter-cluster.md`. **UNCOMMITTED — Jacob commits.**

The gap (horse `.cron/overnight-briefs/2026-08-04.md` N2): the real error hooks install from
inside the app, so a failure that stops the app from starting files nothing — LD had a visitor
sit 92 minutes on a dictionary that could never load, invisibly. Tutor landed the reference
implementation; **read `~/code/tutor/.issues/boot-error-reporter-report.md` FIRST** — especially
the deviation section (the approved error-only shape was measured to MISS both real outages;
the `unhandledrejection` twin is REQUIRED) and its 7 port notes.

Shape: inline ES5 `<script>` in `site/src/app.html` before `%sveltekit.head%` — both `error` +
`unhandledrejection` listeners into one closure, shared one-shot `fired` flag (max ONE row per
page load), `navigator.sendBeacon` of a JSON Blob to **relative** `/api/log`, disarmed by the
real reporter setting `window.__boot_reporter_off` (same flag name as tutor/house) AFTER all its
real listeners are registered. Port tutor's guard test too (the inline script is imported by
nothing — the test is the only thing watching it).

Port-note checklist to VERIFY against LD, not assume (tutor report items 2–6): LD's CSP (none
expected, but check `kit.csp` + Caddy); LD's `/api/log` accepted body shape (single-entry vs
`{ entries }` — match what its `+server.ts` parses); LD's base-url helper (keep the beacon
relative); a `build_target`/region equivalent only if a `PUBLIC_*` env var already exists (else
omit). Acceptance test per tutor's report: against a REAL `pnpm build` + `node build`, (a) block
an `/_app/immutable/entry/*` chunk, (b) break the shell's `__sveltekit_<hash>` global — each must
file exactly ONE `error | boot_error` row with `context.channel`; a healthy load must file zero
with the real reporter taking late faults.

Verification: `pnpm test` / `tsc` / `pnpm check` clean; report to
`.issues/boot-error-reporter-report.md`.
