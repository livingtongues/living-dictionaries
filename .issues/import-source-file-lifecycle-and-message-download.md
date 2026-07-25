# Import source-file lifecycle and message attachment download

Gundolf's Enxet import exposed two connected gaps:

1. successful import materials submitted through the dictionary Import page need
   to leave the pending-import queue and become permanent files attached to the
   corresponding source on the dictionary's Sources page;
2. a newly emailed file in Gundolf's admin message thread cannot currently be
   clicked/downloaded.

Also compare the newly received file with the source file Diego submitted for
Gundolf, update the general agent-facing import workflow, and make sure the
automated import-ready prompt explicitly requires the post-import file
transition.

## Investigation

- ✅ Trace the current R2 buckets/object-key namespaces and `source_files`
  metadata lifecycle.
- ✅ Identify Gundolf's dictionary, existing source, successful import file,
  message thread, and newly received attachment in production.
- ✅ Compare the old and new files byte-for-byte and structurally.
- ✅ Reproduce and diagnose the broken message attachment interaction.

### Findings

- Source/import resources live in private R2 bucket
  `livingdictionaries-attachments`, at stable keys
  `import/{dictionary_id}/{file_id}`. They are deliberately separate from
  public user media in `livingdictionaries-media`
  (`{dictionary_id}/{audio|video|photo}/…`).
- The successful Enxet file is already linked to source
  `enxet-lexicon` (`source_files.source_id =
  4cb1598a-eb54-4067-9bc0-144a3d096f30`). It remains on Import only because the
  page does not filter linked files, while Sources does not yet load/display
  them. No R2 copy is required for the intended lifecycle.
- Gundolf's older contact/email thread
  `0d217640-3cdd-456b-9a00-a84c1143a79b` has no `dictionary_id`. Its latest
  message includes `Enxet-SFM-for-LD.txt`, a private message attachment rather
  than a `source_files` row.
- Non-image admin message attachments are rendered as a plain `<li>` with no
  anchor or click handler. The authenticated download endpoint works; the UI
  supplies no way to invoke it.
- The new file is not the file Diego uploaded:
  - old: 1,091,225 bytes, SHA-256
    `255cd5361ca5324af37d769045ac0ca57d30cc4e2e8da6653a126ccb5de6d974`;
  - new: 1,077,435 bytes, SHA-256
    `074a6b98d4bdcfbebe789d8cde8426ec5687cacc78bb4ee7e81ac660f959e142`.
- After SFM-aware parsing, old = 11,970 source records (35 headwords recovered
  from missing `\lx` markers); new = 11,972 records (0 recovered — those markers
  were repaired). Among aligned records, 6,380 are exact, 5,472 differ only by
  separator cleanup, and at least 73 carry other text/sense changes. The new
  file adds or separates real records (including `Yalaqe’`, `Yá`, and
  `Negyeykhágweykmoho`) and changes homograph/headword metadata, but also
  contains some new missing-space artifacts that require the same Phase 1 audit
  before updating production. Full comparison:
  `/tmp/gundolf-sfm-comparison.json`.

## Implementation

- ✅ Fix message attachment downloads with API/UI coverage.
- ✅ Move/reclassify the completed import material into its permanent source
  attachment lifecycle without losing provenance.
- ✅ Update the public API importing guide with the general successful-import
  cleanup requirement.
- ✅ Update persistent import-workflow knowledge with the internal
  Import-page-specific transition.
- ✅ Update the automated import-ready prompt generated when a user submits
  import materials.
- ✅ Prevent source deletion from orphaning permanent resources: the Sources UI
  and v1 source-delete endpoint now refuse deletion while files are attached.

### Enxet correction and source promotion

- ✅ Audited the corrected SFM against the original import record by record,
  retaining complete older wording where the corrected export introduced
  missing-space/truncation damage.
- ✅ Applied the correction through v1 after a fresh production backup:
  11,968 existing entry PATCHes, 3 creates, 5 stale-sense deletes, and 1
  superseded-entry delete, with zero failures.
- ✅ Production now has 11,971 import-tagged entries and 313 human-audited
  review items; all changed/new targets matched the audited payload on readback.
- ✅ Added Gundolf's corrected file as a second permanent resource under
  `enxet-lexicon`, retaining its private R2 key:
  `import/enxet/10b14c13-e9b3-4d5d-840f-1a9f0f89f6c0`.
- ✅ Downloaded the promoted resource through v1 and verified its exact
  1,077,435-byte size and SHA-256
  `074a6b98d4bdcfbebe789d8cde8426ec5687cacc78bb4ee7e81ac660f959e142`.

## Verification

- ✅ Unit/API/type/lint/Svelte checks:
  - 1,982 Vitest tests passed, 3 skipped (split `src/lib` + `src/routes` runs);
  - `tsc`, ESLint, and `svelte-check` all clean (`svelte-check`: 0 errors);
  - `svelte-fix` found no actionable issue in the new/changed components.
- ✅ Authenticated browser verification of the thread download and source-page
  attachment.
  - svelte-look light/dark desktop/mobile stories show the source-file list and
    the non-image admin attachment as a link.
  - A real dev-manager browser session created/uploaded/confirmed/linked a
    private resource through v1, verified its exact downloaded bytes, saw it
    beneath the proper source, and confirmed it was absent from Import with no
    app runtime errors or horizontal overflow. The temporary fixture was then
    removed. Screenshots: `/tmp/import-source-files.png` and
    `/tmp/import-completed-hidden.png`.
- ✅ Production DB/R2 verification of exact object keys, hashes, and metadata.
  The two Enxet resources both remain linked to source
  `4cb1598a-eb54-4067-9bc0-144a3d096f30` under their original private keys.
  Live `enxet.db` remains healthy: integrity `ok`, 11,971 entries, 11,971 import
  tag links, and the exact 313-review category distribution.
