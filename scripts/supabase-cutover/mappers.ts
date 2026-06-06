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
    orthographies: dict.orthographies ?? null,
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
