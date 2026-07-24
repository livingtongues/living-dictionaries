# Preserve GPS coordinates on photo uploads from phones

We now capture EXIF GPS + capture-date from photo uploads (see `.issues/storage-dashboard-followups.md`
and `.issues/media-r2-migration.md`) and store them on `photos.latitude/longitude/taken_at`. The
**client** path reads EXIF from the original file via exifr before HEIC→JPEG conversion; the **server**
net re-reads from bytes. That works for desktop uploads, Files-app picks, and agent imports.

## The problem
Mobile **gallery pickers strip GPS before the browser ever sees the file**:
- iOS **PHPicker** (the sheet a `<input type="file" accept="image/*">` opens) hands back a
  location-redacted copy — the OS scrubs GPS as a privacy measure unless the app holds full Photos
  permission (which a web page can't).
- Android **Photo Picker** does the same redaction on modern versions.

So the most common real-world uploader (someone in the field on a phone) loses the exact thing we
want. Coordinates today come mostly from desktop/Files-app/agent uploads.

## What to look into (later — Jacob wants to handle this deliberately)
- **Files app / "Browse" path instead of the gallery picker** — on iOS, picking via the Files app
  (Documents) rather than Photos may preserve EXIF. Can we nudge users toward that, or offer a
  "browse files" affordance distinct from the gallery?
- **Generic file picker** (`<input type="file">` without `accept="image/*"`, or with a broader
  accept) — does it route through a different, non-redacting picker on either OS? Test empirically
  on real devices.
- **Native camera capture in-app** (`capture="environment"`) — a photo taken directly through the
  web camera API has no EXIF GPS at all (browsers don't write it); would need the Geolocation API to
  stamp coordinates ourselves at capture time. This is probably the highest-yield path for true
  field capture — attach `navigator.geolocation` fix to the upload when the user shoots in-app.
- **Explicit "tag this photo's location" UI** — let the uploader drop/confirm a pin (reuse the
  existing GeoTaggingModal / map components) when EXIF is absent. Human-in-the-loop fallback.
- Confirm current behavior on real iOS + Android devices before designing — the redaction specifics
  shift across OS versions.

## Related state
- UI **display** of the captured lat/lng was intentionally pulled 2026-07-24 (Jacob wants to decide
  how to surface location before showing it). Data is still captured + stored; the viewer footer no
  longer renders coordinates. Revisit display together with this capture work.
</content>
