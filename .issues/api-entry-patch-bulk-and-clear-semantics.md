# Entry correction API follow-ups

The corrected Enxet re-sync completed successfully through v1, but it exposed
two API/documentation gaps worth fixing separately:

- [ ] Add a batch entry-update route with per-item ordered results and
  idempotent retry semantics. A source revision that changed the citation
  locator on nearly every record required 11,968 individual
  `PATCH …/entries/{id}` requests even though only 26 existing entries had
  linguistic-content changes.
- [ ] Align TypeScript and OpenAPI PATCH shapes with the runtime's clearing
  behavior. Entry `notes` and sense fields such as `variant` successfully clear
  with JSON `null`, but `EntryPatch`/`SensePatch` inherit non-null input types
  and the corresponding OpenAPI input properties are not marked nullable.
  Audit every patchable entry/sense field so the documented contract is
  explicit and tested rather than relying on an implementation detail.

These did not corrupt or block the Enxet correction. The correction runner used
single-entry PATCH requests, captured every response in a hash-bound ledger,
and verified exact readback.
