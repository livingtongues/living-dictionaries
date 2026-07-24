/**
 * Format-import guides for agents (and humans): lean markdown docs served at
 * `/api/v1/guides` (list) + `/api/v1/guides/{slug}` (raw markdown), referenced
 * from the OpenAPI spec so an importing agent fetches ONLY the guide for its
 * source format — the spec itself stays lean. Grow guide-by-guide as real
 * imports teach us things; keep each one tight.
 */

const raw_guides = import.meta.glob('./*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export interface GuideInfo {
  slug: string
  title: string
  description: string
}

/** Hand-curated blurbs, in recommended reading order (`importing` first). */
const GUIDE_DESCRIPTIONS: Record<string, string> = {
  'importing': 'START HERE for any import job — the two-phase workflow. Phase 1 data preparation (inspect the resource, ask the human the linguistic questions inspection raises, stage locally as JSONL/SQLite, review the data by eye in bulk, clean, preview.html sign-off); phase 2 API usage (source registry row + file linking, batching, idempotency, verification, repair/re-sync, rollback, reporting).',
  'spreadsheets': 'CSV/Excel/Google Sheets: column-mapping heuristics, multi-sense and multi-value cells, encoding traps.',
  'flex-lift': 'FLEx, LIFT, and Toolbox/Shoebox SFM-MDF: which export to prefer and the backslash-marker → API field map.',
  'pdf-scans': 'Scanned printed dictionaries: front-matter legend, page-range workflow, diacritic fidelity, per-page citations.',
  'snapshot': 'Bulk reads without pagination: download the dictionary\'s gzipped SQLite snapshot, open it read-only, and query the key tables locally.',
}

function slug_of(path: string): string {
  return path.replace('./', '').replace('.md', '')
}

export function list_guides(): GuideInfo[] {
  const slugs = Object.keys(raw_guides).map(slug_of).filter(slug => slug in GUIDE_DESCRIPTIONS)
  const ordered = Object.keys(GUIDE_DESCRIPTIONS).filter(slug => slugs.includes(slug))
  return ordered.map(slug => ({
    slug,
    title: get_guide(slug)?.match(/^# (.+)$/m)?.[1] ?? slug,
    description: GUIDE_DESCRIPTIONS[slug],
  }))
}

export function get_guide(slug: string): string | null {
  return raw_guides[`./${slug}.md`] ?? null
}

if (import.meta.vitest) {
  describe(list_guides, () => {
    test('every guide has a manifest description and an h1 title', () => {
      const guides = list_guides()
      expect(guides.map(guide => guide.slug)).toEqual(['importing', 'spreadsheets', 'flex-lift', 'pdf-scans', 'snapshot'])
      for (const guide of guides)
        expect(guide.title.length).toBeGreaterThan(4) // eslint-disable-line no-restricted-syntax -- genuine range check
    })

    test('every .md on disk is listed (a new guide must get a description)', () => {
      expect(Object.keys(raw_guides)).toHaveLength(list_guides().length)
    })
  })

  describe(get_guide, () => {
    test('returns raw markdown for a known slug, null otherwise', () => {
      expect(get_guide('importing')).toContain('# Importing a dictionary')
      expect(get_guide('nope')).toBe(null)
    })
  })
}
