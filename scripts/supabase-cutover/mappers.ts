/**
 * Pure row transforms: old Supabase (Postgres) row → new SQLite row.
 *
 * Conventions applied everywhere:
 *   - `created_by` / `updated_by`        → `created_by_user_id` / `updated_by_user_id`
 *   - timestamptz (Date or string)       → ISO 8601 string
 *   - postgres boolean                   → 0 / 1 / null
 *   - `dictionary_id` column             → dropped (the file IS the dictionary)
 *   - `dirty`                            → null (server-origin rows are clean)
 *   - junction tables (no updated_*)     → updated_* = created_*
 *   - JSON columns stay as JS objects/arrays here; the insert layer stringifies
 *     them (see DICT_JSON_COLS / SHARED_JSON_COLS).
 */

import { generateNKeysBetween } from 'fractional-indexing'

export type Row = Record<string, any>

export function to_iso(value: unknown): string | null {
  if (value === null || value === undefined)
    return null
  if (value instanceof Date)
    return value.toISOString()
  return String(value)
}

export function to_int(value: unknown): number | null {
  if (value === null || value === undefined)
    return null
  return value ? 1 : 0
}

/** Collapse a legacy MultiString name → a plain string (`default` else first value). */
function collapse_multistring(name: unknown): string {
  if (typeof name === 'string') return name
  if (name && typeof name === 'object') {
    const map = name as Record<string, string>
    return map.default || Object.values(map).find(Boolean) || ''
  }
  return ''
}

/**
 * Map legacy orthographies (`{ bcp, name: MultiString }[]`, positional lexeme keys
 * `lo1`/`lo2`/…) to the new registry (`{ code, name, bcp? }[]`) plus the
 * `lo{n} → code` key-rewrite map applied to every entry `lexeme` + sentence `text`.
 *
 * `code` prefers the BCP tag; falls back to a slug of the name, then `orth{n}`.
 * Codes are de-duped (a repeated code gets `-2`, `-3`, …). These are the ALTERNATE
 * orthographies only — the primary headword stays keyed `default` and is untouched.
 */
export function map_orthographies(legacy: Row[] | null | undefined): {
  orthographies: Row[] | null
  lo_to_code: Record<string, string>
} {
  const lo_to_code: Record<string, string> = {}
  if (!legacy?.length) return { orthographies: null, lo_to_code }

  const used = new Set<string>(['default'])
  const orthographies = legacy.map((orthography, index) => {
    const bcp = typeof orthography.bcp === 'string' ? orthography.bcp.trim() : ''
    const name = collapse_multistring(orthography.name)
    let code = bcp || slugify(name) || `orth${index + 1}`
    if (used.has(code)) {
      let suffix = 2
      while (used.has(`${code}-${suffix}`)) suffix++
      code = `${code}-${suffix}`
    }
    used.add(code)
    lo_to_code[`lo${index + 1}`] = code
    return bcp ? { code, name, bcp } : { code, name }
  })
  return { orthographies, lo_to_code }
}

/** Rename `lo{n}` keys in a lexeme/text MultiString to their orthography `code`. */
export function rewrite_orthography_keys(multistring: Row | null | undefined, lo_to_code: Record<string, string>): Row | null | undefined {
  if (!multistring || typeof multistring !== 'object') return multistring
  const rewritten: Row = {}
  for (const [key, value] of Object.entries(multistring))
    rewritten[lo_to_code[key] ?? key] = value
  return rewritten
}

/** Audit fields shared by every content/catalog table. */
function audit(source: Row): Row {
  return {
    deleted: to_iso(source.deleted),
    dirty: null,
    created_by_user_id: source.created_by,
    created_at: to_iso(source.created_at),
    updated_by_user_id: source.updated_by ?? source.created_by,
    updated_at: to_iso(source.updated_at ?? source.created_at),
  }
}

// ---------------------------------------------------------------------------
// Sources: free-text → per-dict registry + slug refs
// ---------------------------------------------------------------------------

/** Mirror of site `$lib/helpers/slugify` (scripts is a separate workspace — can't import $lib). */
function slugify(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Build the per-dict `sources` registry from the free-text `sources` strings on
 * already-mapped entry rows, and REWRITE each entry's `sources` array in place
 * to reference slugs. One registry row per distinct string (`slug =
 * slugify(string)`, suffixed on collision; `citation = the original string`).
 * Sentences/texts had no Supabase sources, so only entries feed this.
 */
export function build_dict_sources({ entry_rows, user_id }: { entry_rows: Row[], user_id: string }): Row[] {
  const slug_by_string = new Map<string, string>()
  const taken = new Set<string>()
  const source_rows: Row[] = []
  const now = new Date().toISOString()

  for (const entry of entry_rows) {
    const list: unknown[] = Array.isArray(entry.sources) ? entry.sources : []
    const slugs: string[] = []
    for (const raw of list) {
      const text = String(raw ?? '').trim()
      if (!text)
        continue
      let slug = slug_by_string.get(text)
      if (!slug) {
        const base = slugify(text) || 'source'
        slug = base
        let n = 2
        while (taken.has(slug))
          slug = `${base}-${n++}`
        taken.add(slug)
        slug_by_string.set(text, slug)
        source_rows.push({
          id: crypto.randomUUID(),
          slug,
          citation: text,
          abbreviation: null,
          author: null,
          year: null,
          url: null,
          license: null,
          type: null,
          dirty: null,
          created_by_user_id: user_id,
          created_at: now,
          updated_by_user_id: user_id,
          updated_at: now,
        })
      }
      if (!slugs.includes(slug))
        slugs.push(slug)
    }
    entry.sources = slugs.length ? slugs : null
  }
  return source_rows
}

// ---------------------------------------------------------------------------
// Legacy audio.source person-names → speaker links / registry citations
// ---------------------------------------------------------------------------

export interface AudioSourceResolution {
  new_speakers: Row[]
  new_audio_speakers: Row[]
  new_sources: Row[]
}

/**
 * Legacy `audio.source` free-text is ALWAYS a person name (verified across prod
 * 2026-07-02: 14 distinct values / 605 rows, e.g. 'Yafeth Warijo' ×298,
 * 'javier domingo' ×226 — see `.issues/media-attribution-speaker-or-source.md`).
 * The new model treats `audio.source` as a STRICT `sources.slug` registry ref,
 * so free text must resolve. Per (dict, trimmed case-folded name) group:
 *
 *  1. A speaker with that name exists in the dict → ensure an `audio_speakers`
 *     link on every row (insert missing), NULL the source (now redundant).
 *  2. No matching speaker AND every row in the group is speaker-less → the name
 *     IS presumed the speaker (person recorded themselves / was recorded):
 *     CREATE the speaker, link all rows, NULL the source. Trim/case variants
 *     collapse to one speaker (most frequent raw variant wins the display name).
 *  3. Else (some rows already link to OTHER speakers → the name is the
 *     recorder/contributor, not the speaker): keep it as attribution — create a
 *     sources-registry citation row (slug = slugify(name), citation = name) and
 *     rewrite `audio.source` to the slug.
 *
 * MUTATES the passed audio rows' `source`; returns rows to insert. Synthesized
 * rows go through map_speaker/map_junction so their column sets match the
 * mapped rows they're batch-inserted with. Rows marked `deleted` are ignored.
 */
export function resolve_audio_source_names({ audio_rows, speaker_rows, junction_rows, existing_slugs, user_id }: {
  audio_rows: Row[]
  speaker_rows: Row[]
  junction_rows: Row[]
  /** Slugs already taken by the entry-sources registry (collision-avoidance). */
  existing_slugs: Set<string>
  user_id: string
}): AudioSourceResolution {
  const fold = (name: string) => name.trim().toLowerCase()
  const now = new Date().toISOString()
  const resolution: AudioSourceResolution = { new_speakers: [], new_audio_speakers: [], new_sources: [] }

  const speaker_by_fold = new Map<string, Row>()
  for (const speaker of speaker_rows) {
    const key = fold(String(speaker.name ?? ''))
    if (key && !speaker_by_fold.has(key))
      speaker_by_fold.set(key, speaker)
  }

  const links_by_audio = new Map<string, Set<string>>()
  for (const junction of junction_rows) {
    if (!links_by_audio.has(junction.audio_id))
      links_by_audio.set(junction.audio_id, new Set())
    links_by_audio.get(junction.audio_id)!.add(junction.speaker_id)
  }

  const groups = new Map<string, { variants: Map<string, number>, rows: Row[] }>()
  for (const row of audio_rows) {
    if (row.deleted)
      continue
    const raw = typeof row.source === 'string' ? row.source.trim() : ''
    if (!raw)
      continue
    const key = fold(raw)
    if (!groups.has(key))
      groups.set(key, { variants: new Map(), rows: [] })
    const group = groups.get(key)!
    group.variants.set(raw, (group.variants.get(raw) ?? 0) + 1)
    group.rows.push(row)
  }

  const link = ({ audio_row, speaker_id }: { audio_row: Row, speaker_id: string }) => {
    const linked = links_by_audio.get(audio_row.id)
    if (linked?.has(speaker_id))
      return
    resolution.new_audio_speakers.push(map_junction(
      { audio_id: audio_row.id, speaker_id, created_by: audio_row.created_by_user_id ?? user_id, created_at: now },
      ['audio_id', 'speaker_id'],
    ))
  }

  for (const [key, group] of groups) {
    const display = [...group.variants.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const matched_speaker = speaker_by_fold.get(key)

    if (matched_speaker) {
      for (const row of group.rows) {
        link({ audio_row: row, speaker_id: matched_speaker.id })
        row.source = null
      }
      continue
    }

    const any_row_linked = group.rows.some(row => (links_by_audio.get(row.id)?.size ?? 0) > 0)
    if (!any_row_linked) {
      const speaker = map_speaker({
        id: crypto.randomUUID(),
        name: display,
        created_by: group.rows[0].created_by_user_id ?? user_id,
        created_at: now,
      })
      resolution.new_speakers.push(speaker)
      speaker_by_fold.set(key, speaker)
      for (const row of group.rows) {
        link({ audio_row: row, speaker_id: speaker.id })
        row.source = null
      }
      continue
    }

    // Recorder/contributor semantics → registry citation, same shape as build_dict_sources rows.
    const base = slugify(display) || 'source'
    let slug = base
    let suffix = 2
    while (existing_slugs.has(slug))
      slug = `${base}-${suffix++}`
    existing_slugs.add(slug)
    resolution.new_sources.push({
      id: crypto.randomUUID(),
      slug,
      citation: display,
      abbreviation: null,
      author: null,
      year: null,
      url: null,
      license: null,
      type: null,
      dirty: null,
      created_by_user_id: user_id,
      created_at: now,
      updated_by_user_id: user_id,
      updated_at: now,
    })
    for (const row of group.rows)
      row.source = slug
  }

  return resolution
}

// ---------------------------------------------------------------------------
// shared.db
// ---------------------------------------------------------------------------

export function map_user({ auth_user, profile, user_data, providers }: {
  auth_user: Row
  profile?: Row
  user_data?: Row
  providers: { provider: string, provider_id: string }[]
}): Row {
  return {
    id: auth_user.id,
    email: auth_user.email ?? profile?.email ?? null,
    name: profile?.full_name ?? auth_user.raw_user_meta_data?.full_name ?? null,
    avatar_url: profile?.avatar_url ?? auth_user.raw_user_meta_data?.avatar_url ?? null,
    providers: providers.length ? providers : [{ provider: 'email', provider_id: auth_user.email ?? auth_user.id }],
    unsubscribed_from_emails: to_iso(user_data?.unsubscribed_from_emails),
    preferred_locale: null,
    last_visit_at: null,
    created_at: to_iso(auth_user.created_at) ?? new Date().toISOString(),
    updated_at: to_iso(user_data?.updated_at ?? auth_user.updated_at ?? auth_user.created_at) ?? new Date().toISOString(),
  }
}

export function map_dictionary({ dict, info, entry_count }: {
  dict: Row
  info?: Row
  entry_count: number
}): Row {
  return {
    id: dict.id,
    url: dict.url ?? null,
    name: dict.name,
    alternate_names: dict.alternate_names ?? null,
    gloss_languages: dict.gloss_languages ?? null,
    location: dict.location ?? null,
    coordinates: dict.coordinates ?? null,
    iso_639_3: dict.iso_639_3 ?? null,
    glottocode: dict.glottocode ?? null,
    public: to_int(dict.public),
    print_access: to_int(dict.print_access),
    metadata: dict.metadata ?? null,
    entry_count,
    orthographies: map_orthographies(dict.orthographies).orthographies,
    featured_image: dict.featured_image ?? null,
    author_connection: dict.author_connection ?? null,
    community_permission: dict.community_permission ?? null,
    language_used_by_community: to_int(dict.language_used_by_community),
    con_language_description: dict.con_language_description ?? null,
    copyright: dict.copyright ?? null,
    hide_living_tongues_logo: to_int(dict.hide_living_tongues_logo),
    about: info?.about ?? null,
    citation: info?.citation ?? null,
    grammar: info?.grammar ?? null,
    write_in_collaborators: info?.write_in_collaborators ?? null,
    snapshot_uploaded_at: null,
    dict_db_schema_version: null,
    created_at: to_iso(dict.created_at),
    created_by_user_id: dict.created_by ?? null,
    updated_at: to_iso(dict.updated_at ?? dict.created_at),
    updated_by_user_id: dict.updated_by ?? dict.created_by ?? null,
    dirty: null,
  }
}

export function map_dictionary_role(role: Row): Row {
  return {
    id: crypto.randomUUID(),
    dictionary_id: role.dictionary_id,
    user_id: role.user_id,
    role: role.role,
    invited_by_user_id: role.invited_by ?? null,
    dirty: null,
    created_at: to_iso(role.created_at),
    updated_at: to_iso(role.created_at),
  }
}

export function map_dictionary_partner({ partner, photo }: { partner: Row, photo?: Row }): Row {
  return {
    id: partner.id,
    dictionary_id: partner.dictionary_id,
    name: partner.name,
    photo_storage_path: photo?.storage_path ?? null,
    photo_serving_url: photo?.serving_url ?? null,
    dirty: null,
    created_at: to_iso(partner.created_at),
    updated_at: to_iso(partner.updated_at ?? partner.created_at),
  }
}

export function map_invite(invite: Row): Row {
  return {
    id: invite.id,
    dictionary_id: invite.dictionary_id,
    inviter_user_id: invite.created_by,
    inviter_email: invite.inviter_email,
    target_email: invite.target_email,
    role: invite.role,
    status: invite.status,
    dirty: null,
    created_at: to_iso(invite.created_at),
    updated_at: to_iso(invite.created_at),
  }
}

// ---------------------------------------------------------------------------
// dictionaries/{id}.db
// ---------------------------------------------------------------------------

export function map_entry(entry: Row): Row {
  return {
    id: entry.id,
    lexeme: entry.lexeme,
    phonetic: entry.phonetic ?? null,
    interlinearization: entry.interlinearization ?? null,
    morphology: entry.morphology ?? null,
    notes: entry.notes ?? null,
    sources: entry.sources ?? null,
    scientific_names: entry.scientific_names ?? null,
    coordinates: entry.coordinates ?? null,
    unsupported_fields: entry.unsupported_fields ?? null,
    elicitation_id: entry.elicitation_id ?? null,
    ...audit(entry),
  }
}

export function map_text(text: Row): Row {
  return {
    id: text.id,
    title: text.title,
    ...audit(text),
  }
}

/**
 * Convert legacy `texts.sentences` JSON arrays (ordered sentence ids +
 * `{ paragraph_break: true }` markers) into a per-sentence ordering map:
 * `sentence_id -> { sort_key, ends_paragraph }`. The new model stores order on
 * each sentence (fractional `sort_key`) instead of an id-array on the parent.
 * A paragraph-break marker flags the sentence that precedes it.
 */
export function build_sentence_order(texts: Row[]): Map<string, { sort_key: string, ends_paragraph: number | null }> {
  const order = new Map<string, { sort_key: string, ends_paragraph: number | null }>()
  for (const text of texts) {
    const raw = typeof text.sentences === 'string' ? safe_parse(text.sentences) : text.sentences
    const items: any[] = Array.isArray(raw) ? raw : []
    const ids: string[] = []
    const paragraph_after = new Set<string>()
    for (const item of items) {
      if (typeof item === 'string')
        ids.push(item)
      else if (item?.paragraph_break && ids.length)
        paragraph_after.add(ids[ids.length - 1])
    }
    if (ids.length === 0)
      continue
    const keys = generateNKeysBetween(null, null, ids.length)
    ids.forEach((id, index) => {
      order.set(id, { sort_key: keys[index], ends_paragraph: paragraph_after.has(id) ? 1 : null })
    })
  }
  return order
}

function safe_parse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function map_sense(sense: Row): Row {
  return {
    id: sense.id,
    entry_id: sense.entry_id,
    definition: sense.definition ?? null,
    glosses: sense.glosses ?? null,
    parts_of_speech: sense.parts_of_speech ?? null,
    semantic_domains: sense.semantic_domains ?? null,
    write_in_semantic_domains: sense.write_in_semantic_domains ?? null,
    noun_class: sense.noun_class ?? null,
    plural_form: sense.plural_form ?? null,
    variant: sense.variant ?? null,
    ...audit(sense),
  }
}

export function map_sentence(sentence: Row): Row {
  return {
    id: sentence.id,
    text: sentence.text ?? null,
    translation: sentence.translation ?? null,
    text_id: sentence.text_id ?? null,
    // Set from build_sentence_order during migration (NULL for standalone example sentences).
    sort_key: null,
    ends_paragraph: null,
    ...audit(sentence),
  }
}

export function map_speaker(speaker: Row): Row {
  return {
    id: speaker.id,
    name: speaker.name,
    decade: speaker.decade ?? null,
    gender: speaker.gender ?? null,
    birthplace: speaker.birthplace ?? null,
    user_id: speaker.user_id ?? null,
    ...audit(speaker),
  }
}

export function map_audio(audio: Row): Row {
  return {
    id: audio.id,
    entry_id: audio.entry_id ?? null,
    sentence_id: audio.sentence_id ?? null,
    text_id: audio.text_id ?? null,
    storage_path: audio.storage_path,
    source: audio.source ?? null,
    ...audit(audio),
  }
}

export function map_video(video: Row): Row {
  return {
    id: video.id,
    storage_path: video.storage_path ?? null,
    hosted_elsewhere: video.hosted_elsewhere ?? null,
    source: video.source ?? null,
    videographer: video.videographer ?? null,
    text_id: video.text_id ?? null,
    ...audit(video),
  }
}

export function map_photo(photo: Row): Row {
  return {
    id: photo.id,
    storage_path: photo.storage_path,
    serving_url: photo.serving_url,
    source: photo.source ?? null,
    photographer: photo.photographer ?? null,
    ...audit(photo),
  }
}

export function map_dialect(dialect: Row): Row {
  return {
    id: dialect.id,
    name: dialect.name,
    ...audit(dialect),
  }
}

export function map_tag(tag: Row): Row {
  return {
    id: tag.id,
    name: tag.name,
    private: to_int(tag.private),
    ...audit(tag),
  }
}

/**
 * Junction tables: old composite PK → synthetic UUID PK + UNIQUE on the natural
 * key. `columns` is the natural-key column list (e.g. ['sense_id','sentence_id']).
 */
export function map_junction(source: Row, columns: string[]): Row {
  const row: Row = { id: crypto.randomUUID() }
  for (const column of columns)
    row[column] = source[column]
  return { ...row, ...audit(source) }
}

// ---------------------------------------------------------------------------
// JSON column maps (insert layer stringifies these)
// ---------------------------------------------------------------------------

export const DICT_JSON_COLS: Record<string, string[]> = {
  entries: ['lexeme', 'notes', 'sources', 'scientific_names', 'coordinates', 'unsupported_fields'],
  texts: ['title'],
  senses: ['definition', 'glosses', 'parts_of_speech', 'semantic_domains', 'write_in_semantic_domains', 'plural_form', 'variant'],
  sentences: ['text', 'translation'],
  dialects: ['name'],
  videos: ['hosted_elsewhere'],
}

export const SHARED_JSON_COLS: Record<string, string[]> = {
  users: ['providers'],
  dictionaries: ['alternate_names', 'gloss_languages', 'coordinates', 'metadata', 'orthographies', 'featured_image', 'write_in_collaborators'],
}
