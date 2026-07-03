# Admin "Agent API" docs page

Add an admin home card + `/admin/api-docs` page that renders the live
`/api/v1/openapi.json` spec in a human-friendly way, so admins can periodically
review exactly what agents read to self-configure. No data copy — the page
fetches the spec live via `+page.ts` load.

## Decisions
- Hand-rolled Svelte renderer (no CDN doc tool). Matches repo conventions.
- Route `/admin/api-docs`, card titled "Agent API".

## Plan / files
- ✅ `admin/api-docs/+page.ts` — `fetch('/api/v1/openapi.json')` → `{ spec }`
- ✅ `admin/api-docs/helpers.ts` — `ref_name`, `type_label`, `group_for_path`, method order/colors
- ✅ `admin/api-docs/schema-view.svelte` — recursive schema property renderer (refs link to #schema-Name)
- ✅ `admin/api-docs/+page.svelte` — info.description as markdown (tw-prose), endpoints grouped by resource in <details>, schemas section
- ✅ Admin home `+page.svelte` — add "Agent API" nav box
- ✅ Admin `+layout.svelte` — add nav link

## Verify
- ✅ `pnpm check` — 0 errors
- ✅ `pnpm eslint` on touched files — clean
- ✅ Headless puppeteer at `/admin/api-docs` (login OTP + dev_admin_level=2): 87
  ops, all 13 groups in order + Schemas, no page errors. Screenshots confirm
  markdown overview, endpoint blocks (params/body/responses), and recursive
  SchemaView (unions, ref links, nested props) all render cleanly.

DONE — awaiting confirmation.
