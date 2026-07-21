# Import upload blocked by R2 CORS

Production `/{dictionary}/import` uploads register successfully but the browser's direct presigned
PUT to `livingdictionaries-attachments` fails its OPTIONS preflight because the private R2 bucket
does not return an `Access-Control-Allow-Origin` header for `https://livingdictionaries.app`.

## Plan and progress

- [x] Confirm the failing browser request and inspect the presigned request headers. ✅
- [x] Audit `client_logs` to determine whether the upload failure is captured and who encountered it. ✅
- [x] Configure the R2 attachments bucket CORS policy for the production app origin and the exact
      PUT method/headers required by the import uploader.
- [x] Make the bucket policy reproducible from the repository and add a focused regression check. ✅
- [x] Add explicit structured client telemetry for import upload failures if the existing global
      console/error capture does not preserve enough context.
- [x] Verify the live CORS preflight and run the relevant unit/type/lint checks. ✅

## Findings

- The import client registers a `source_files` row, sends the bytes with XHR directly to a 10-minute
  R2 presigned PUT URL, and only then calls the confirm endpoint.
- The upload code catches the rejected `done` promise and calls `console.error(err)`, but it does not
  emit an import-specific event with dictionary/file/stage context.
- The old generic telemetry did reach production `client_logs`. In the preceding 14 days it captured
  six failures from three users, all on July 20–21:
  - Jacob — `wenshanhua` — `IMG_20251116_160248.jpg` (6,363,347 bytes), one attempt.
  - Gregory Anderson — `opyt321` —
    `Louis-V.-Headman-and-Sean-ONeill-Dictionary-of-the-Ponca-People-Book-2019.pdf`
    (9,258,502 bytes), two attempts.
  - Vincent — `iipay-aa` — `Export to Iipay Aa Living Dictionary - MG and BITD.xlsx`
    (144,132 bytes), three attempts.
  Each attempt registered an unconfirmed `source_files` row before the browser's R2 PUT failed.
- The R2 CORS API initially returned `10059: The CORS configuration does not exist.` The checked-in
  `cf-worker/r2-cors.json` policy was applied to `livingdictionaries-attachments`: production origin
  only, `PUT`, `Content-Type`, exposed `ETag`, 3600-second preflight cache. `cf-worker/package.json`
  now has Wrangler apply/list commands so the external policy has a repository source of truth.
- A live OPTIONS request to the bucket's S3 endpoint now returns `204` plus:
  `Access-Control-Allow-Origin: https://livingdictionaries.app`,
  `Access-Control-Allow-Methods: PUT`, and `Access-Control-Allow-Headers: content-type`.
- `upload-import-file.ts` now emits one `level='error'`, `message='import_upload_failed'` row for
  non-abort failures. Context includes dictionary ID, source-file ID, filename/type/size, stage
  (`register`, `upload`, or `confirm`), failure kind, status, upload origin (never the signed URL),
  and the error message. This replaces the context-poor generic `console.error` row.

## Verification

- `pnpm vitest run src/lib/import/upload-import-file.test.ts` — 5 tests passed.
- `pnpm check` — passed.
- `pnpm lint` — passed after resolving the two reported style errors.
- `pnpm test --run` — passed.
- Production R2 preflight — `204`, expected allow headers present.
