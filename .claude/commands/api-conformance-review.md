---
description: Recurring product-contract-conformance audit for Living Dictionaries' agent-facing /api/v1 write API. Reconciles the published OpenAPI spec (the written contract) against the actual route handlers, validated input shapes, permission rules, and tests — building a requirement ledger (proved / weak / contradicted / unimplemented) and fixing confirmed high-impact code↔spec mismatches. AUDIT-FIRST — read-only until Jacob promotes it; then it may fix ONE verified mismatch + regression test, uncommitted. Never edits the spec's DESIGN — only reconciles code to contract.
---

# Product Contract Conformance Loop (`/api/v1`)

The v1 agent API is under heavy, active development (grammar/IGT surface, media writes, entry
relationships, conlang gating…) with an **OpenAPI spec as its written contract**. Every milestone is
a chance for the implementation to drift from the spec: a documented field the server doesn't
enforce, a permission rule the code doesn't honor, an endpoint the spec forgot, a required field the
handler treats as optional. This loop keeps the **contract and the code in lockstep** so agents can
trust `openapi.json` to self-configure from.

> **Adapted from Loop Library #076 "product contract conformance loop."** The check is nearly
> pre-built: the spec already exists (`$lib/api/v1/openapi.ts` → `/api/v1/openapi.json`) and
> `openapi.test.ts` already compile-time-locks the key inventories. You're extending, not starting.

## Authority (start here)

**AUDIT-FIRST / read-only.** For the first several runs you ONLY build the ledger and write the dated
digest — no code changes. Once Jacob trusts the lane, you may make **exactly ONE** bounded, confirmed
fix per run **with a regression test**, left **uncommitted** for review. **Non-goal:** never touch
the spec's *design* — you reconcile **code → spec**, not spec → whatever the code happens to do (a
genuine spec bug gets *reported*, not silently rewritten). Never weaken a test to make it pass.

## The check (mostly pre-built)

- Baseline gate: `pnpm vitest run src/lib/api/v1/openapi.test.ts` must be **green**. It already
  asserts (a) schema property keys == the TS `EntryInput`/`SenseInput`/… shapes via compile-time
  `Record<keyof X, true>` inventories, (b) the exact path+method surface, (c) every op is tagged,
  (d) no `[DRAFT]`/`x-status` leftovers, (e) valid OpenAPI 3.1. If it's red, that's finding #1.
- The **contract** = `build_openapi_spec()` (`src/lib/api/v1/openapi.ts`), served at
  `/api/v1/openapi.json`.
- The **implementation** = the `+server.ts` handlers under `src/routes/api/v1/**`, the validated
  input parsers in `src/lib/api/v1/*-input.ts`, and the shared write helpers in
  `src/lib/db/server/` they route through.
- The **enforcement tests** = the per-route `server.test.ts` files + `verify_auth_dict_role` and the
  api-key/access paths.

## Each run — build the requirement ledger

1. Run the baseline gate (above).
2. **Extract every promise** from the spec into a ledger row: for each path+method and each
   request/response schema field, note what the contract claims (required vs optional, type/enum,
   permission/tag, described behavior, idempotency, error shape).
3. **Mark each row against the actual code**: `proved` (handler + a test enforce it),
   `weak` (handler enforces but no test pins it), `contradicted` (code does something the spec
   doesn't say, or vice-versa), `unimplemented` (spec documents it, handler doesn't do it).
4. **Rank confirmed mismatches** by agent-facing impact (a required field the handler ignores, a
   permission the code doesn't check, a documented endpoint that 404s > a missing example > a prose
   nit). Note deltas vs the previous dated ledger.
5. Write a dated digest to `.cron/api-conformance-reviews/YYYY-MM-DD.md`
   (style: `~/code/horse/.cron/report-style.md`) — TL;DR, the ledger summary counts, the ranked
   mismatches, and the single highest-impact next fix.
6. (Only once promoted) apply the **one** top fix if clearly correct, add a regression test, run the
   v1 suites green, leave it uncommitted, and record it in the digest.

## Cadence

Run **after a v1 milestone lands** (the drift moments) or monthly, whichever comes first. Because the
spec is a ready-made re-runnable check, this is the lowest-lift of the fleet's quality loops — the
second observation is nearly free.
