/**
 * Seed a VARIETY of entry shapes into the local `dev` ("Dev Playground") fixture
 * dictionary for eyeballing the entries-list design (gloss/definition/media/
 * multi-sense/orthography cases). Run `pnpm -F site seed:dev-fixture` first.
 *
 *   pnpm -F site seed:variety
 *
 * Idempotent: deletes all `demo_*` rows first, then inserts. Timestamps are fixed
 * in the past so the editor "recently updated" underline doesn't light up. Also
 * writes real image bytes into the dev-media store (via ImageMagick when
 * available) so the photo gallery + video thumbnails render distinct images.
 * Log in as dev-manager@example.com (dev OTP, see dev-auth skill) for the editor view.
 */
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import Database from 'better-sqlite3'

const MOCK_USER_ID = '00000000-0000-4000-8000-000000000001'
const AT = '2026-07-20T00:00:00.000Z'
const DICTIONARY_ID = 'dev'

const data_dir = process.env.DATA_DIR || '.data'
const db = new Database(join(data_dir, 'dictionaries', `${DICTIONARY_ID}.db`))

const audit = { created_by_user_id: MOCK_USER_ID, created_at: AT, updated_by_user_id: MOCK_USER_ID, updated_at: AT }

// Rows must carry a server-assigned `server_seq` or the /changes sync never
// delivers them to clients whose cursor is past the old watermark.
function next_server_seq(): number {
  db.prepare('UPDATE server_seq_counter SET seq = seq + 1').run()
  const { seq } = db.prepare('SELECT seq FROM server_seq_counter').get() as { seq: number }
  return seq
}

function insert(table: string, row: Record<string, unknown>) {
  const full = { ...row, ...audit, server_seq: next_server_seq() }
  const keys = Object.keys(full)
  db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(key => `@${key}`).join(', ')})`)
    .run(Object.fromEntries(Object.entries(full).map(([key, value]) => [key, typeof value === 'object' && value !== null ? JSON.stringify(value) : value])))
}

// Distinct solid-color images in the dev-media store so gallery navigation and
// video thumbnails are visually verifiable (each photo/thumb looks different).
function write_dev_image({ key, color, label }: { key: string, color: string, label: string }) {
  const path = join(data_dir, 'dev-media', key)
  if (existsSync(path)) return
  mkdirSync(dirname(path), { recursive: true })
  try {
    execFileSync('magick', ['-size', '600x600', `xc:${color}`, '-gravity', 'center', '-pointsize', '64', '-fill', 'white', '-annotate', '0', label, path])
  } catch {
    console.warn(`⚠ ImageMagick unavailable — skipped ${key} (placeholder will serve instead)`)
  }
}

// wipe previous demo rows (junctions first)
for (const [table, column] of [
  ['sense_photos', 'id'], ['sense_videos', 'id'], ['audio', 'id'], ['photos', 'id'], ['videos', 'id'],
  ['entry_dialects', 'id'], ['dialects', 'id'], ['senses', 'id'], ['entries', 'id'],
]) db.prepare(`DELETE FROM ${table} WHERE ${column} LIKE 'demo_%'`).run()

let sense_counter = 0
function add_entry({ id, lexeme, phonetic, homograph, scientific_names, senses }: {
  id: string
  lexeme: string | Record<string, string>
  phonetic?: string
  homograph?: string
  scientific_names?: string[]
  senses: Record<string, unknown>[]
}) {
  const lexeme_value = typeof lexeme === 'string' ? { default: lexeme } : lexeme
  insert('entries', { id, lexeme: lexeme_value, phonetic: phonetic ?? null, homograph: homograph ?? null, scientific_names: scientific_names ?? null })
  const sense_ids: string[] = []
  for (const sense of senses) {
    const sense_id = `demo_s${++sense_counter}`
    insert('senses', { id: sense_id, entry_id: id, ...sense })
    sense_ids.push(sense_id)
  }
  return sense_ids
}

// 1 — plain gloss-only (both languages)
add_entry({ id: 'demo_gloss_only', lexeme: 'akem', phonetic: 'a.kem', senses: [{ glosses: { es: 'agua', en: 'water' } }] })

// 2 — definition-only (the Enxet "-Exma" case: was invisible before)
add_entry({ id: 'demo_def_only', lexeme: '-exma', senses: [
  { definition: { es: 'clítico que muchas veces actúa como afijo que acompaña a ciertos verbos o adverbios de la sexta conjugación' } },
] })

// 3 — gloss + definition together (secondary clamped line)
add_entry({ id: 'demo_gloss_def', lexeme: 'egken', phonetic: 'eg.ken', senses: [
  {
    glosses: { es: 'madre, mamá', en: 'mother' },
    definition: { es: 'término de parentesco para la progenitora; se usa también para tías maternas en el habla tradicional de las comunidades del sur', en: 'kinship term for one\'s mother; traditionally extended to maternal aunts' },
  },
] })

// 4 — lexeme-only (empty sense — 539 of these in Enxet)
add_entry({ id: 'demo_lexeme_only', lexeme: 'agkaméko', senses: [{}] })

// 5 — multi-sense, gloss-only (numbered inline)
add_entry({ id: 'demo_multi4', lexeme: 'áwa', phonetic: 'a.wa', senses: [
  { glosses: { es: 'cabello, pelo', en: 'hair' } },
  { glosses: { es: 'hoja (de árbol, planta)', en: 'leaf (of tree, plant)' } },
  { glosses: { es: 'hoja de libro, página', en: 'page of a book' } },
  { glosses: { es: 'pluma', en: 'feather' } },
] })

// 6 — multi-sense MIXED: gloss-only / definition-only / both
add_entry({ id: 'demo_multi_mixed', lexeme: 'nekha', senses: [
  { glosses: { es: 'al lado, en el borde', en: 'beside, at the edge' } },
  { definition: { es: 'partícula que indica posición relativa respecto a un punto de referencia' } },
  { glosses: { es: 'algunos, algunas' }, definition: { es: 'cuantificador indefinido para grupos pequeños' } },
] })

// 7 — 9 senses (clamp-4-lines stress test)
add_entry({ id: 'demo_multi9', lexeme: 'apyoxma', senses: Array.from({ length: 9 }, (_, index) => (
  { glosses: { es: `sentido número ${index + 1} con texto suficiente`, en: `sense number ${index + 1} with plenty of words` } }
)) })

// 8 — audio only
add_entry({ id: 'demo_audio', lexeme: 'yenneq', phonetic: 'jen.neq', senses: [{ glosses: { es: 'perro', en: 'dog' } }] })
insert('audio', { id: 'demo_audio_a1', entry_id: 'demo_audio', sentence_id: null, text_id: null, storage_path: 'dev/audio/aud_ja.mp3', source: null })

// 9 — photo only
const [photo_sense] = add_entry({ id: 'demo_photo', lexeme: 'sekhet', senses: [{ glosses: { es: 'luna, mes', en: 'moon, month' } }] })
write_dev_image({ key: 'dev/photo/demo-moon.png', color: '#334155', label: 'moon' })
insert('photos', { id: 'demo_photo_p1', storage_path: '', serving_url: 'dev-local:dev/photo/demo-moon.png', source: 'Demo fixture photo', photographer: 'Demo Photographer' })
insert('sense_photos', { id: 'demo_photo_sp1', sense_id: photo_sense, photo_id: 'demo_photo_p1' })

// 10 — video only, UPLOADED file with an R2-convention key: its `_thumb.webp`
// sibling EXISTS in the dev-media store → real video thumbnail renders.
const VIDEO_UUID_A = '11111111-1111-4111-8111-111111111111'
const [video_sense] = add_entry({ id: 'demo_video', lexeme: 'wesse', senses: [{ glosses: { es: 'jefe, líder', en: 'chief, leader' } }] })
write_dev_image({ key: `dev/video/${VIDEO_UUID_A}_thumb.webp`, color: '#7c3aed', label: 'video' })
insert('videos', { id: 'demo_video_v1', storage_path: `dev/video/${VIDEO_UUID_A}.mp4`, hosted_elsewhere: null, hosted_metadata: null, source: null, videographer: null, text_id: null })
insert('sense_videos', { id: 'demo_video_sv1', sense_id: video_sense, video_id: 'demo_video_v1' })

// 10b — HOSTED video (YouTube) with cached hosted_metadata.thumbnail_url
const [hosted_video_sense] = add_entry({ id: 'demo_video_hosted', lexeme: 'apqank', senses: [{ glosses: { es: 'canto ceremonial', en: 'ceremonial song' } }] })
insert('videos', {
  id: 'demo_video_v2',
  storage_path: null,
  hosted_elsewhere: { type: 'youtube', video_id: 'jNQXAC9IVRw' },
  hosted_metadata: { title: 'Demo hosted video', thumbnail_url: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg' },
  source: null,
  videographer: null,
  text_id: null,
})
insert('sense_videos', { id: 'demo_video_sv2', sense_id: hosted_video_sense, video_id: 'demo_video_v2' })

// 11 — ALL media, MULTIPLE distinct photos (gallery test), gloss + definition.
// Uploaded video has NO thumb sibling → exercises the thumbnail fallback.
const VIDEO_UUID_B = '22222222-2222-4222-8222-222222222222'
const [all_media_sense] = add_entry({
  id: 'demo_all_media', lexeme: 'apkelwa', phonetic: 'ap.kel.wa', senses: [
    { glosses: { es: 'casa comunal', en: 'communal house' }, definition: { es: 'construcción tradicional donde se reúne la comunidad para asambleas y ceremonias' } },
  ],
})
insert('audio', { id: 'demo_all_a1', entry_id: 'demo_all_media', sentence_id: null, text_id: null, storage_path: 'dev/audio/aud_tzi.mp3', source: null })
for (const [index, color] of [['a', '#b45309'], ['b', '#0e7490'], ['c', '#4d7c0f']] as const) {
  write_dev_image({ key: `dev/photo/demo-house-${index}.png`, color, label: `house ${index}` })
  insert('photos', { id: `demo_all_p_${index}`, storage_path: '', serving_url: `dev-local:dev/photo/demo-house-${index}.png`, source: `Demo fixture photo ${index}`, photographer: null })
  insert('sense_photos', { id: `demo_all_sp_${index}`, sense_id: all_media_sense, photo_id: `demo_all_p_${index}` })
}
insert('videos', { id: 'demo_all_v1', storage_path: `dev/video/${VIDEO_UUID_B}.mp4`, hosted_elsewhere: null, hosted_metadata: null, source: null, videographer: null, text_id: null })
insert('sense_videos', { id: 'demo_all_sv1', sense_id: all_media_sense, video_id: 'demo_all_v1' })

// 12 — rich metadata: POS, semantic domains (real + write-in), plural, scientific name, dialect
add_entry({
  id: 'demo_rich', lexeme: 'arrorr', phonetic: 'a.roːr', scientific_names: ['<i>Canis lupus</i>'], senses: [
    {
      glosses: { es: 'lobo', en: 'wolf' },
      parts_of_speech: ['n'],
      semantic_domains: ['1.4'],
      write_in_semantic_domains: ['Forest animals'],
      plural_form: { default: 'arrorres' },
    },
  ],
})
insert('dialects', { id: 'demo_dialect_north', name: { default: 'Northern' }, coordinates: null })
insert('entry_dialects', { id: 'demo_ed1', entry_id: 'demo_rich', dialect_id: 'demo_dialect_north' })

// 13 — long-everything mobile stress test
add_entry({
  id: 'demo_long', lexeme: 'apkelwanmegkesamakpoho', phonetic: 'ap.kel.wan.meg.ke.sa.mak.po.ho', senses: [
    {
      glosses: { es: 'expresión que describe la acción de reunirse repetidamente sin llegar a un acuerdo definitivo', en: 'expression describing the act of repeatedly gathering without reaching a final agreement' },
      definition: { es: 'se emplea en contextos de deliberación comunitaria prolongada, especialmente cuando las partes regresan varias veces al mismo punto de discusión sin resolverlo; connota paciencia y también cierta frustración colectiva' },
    },
  ],
})

// 14 — homograph pair (deliberate printed-dictionary numbering — always a full set)
add_entry({ id: 'demo_homograph1', lexeme: 'maha', homograph: '1', senses: [{ glosses: { es: 'sal', en: 'salt' } }] })
add_entry({ id: 'demo_homograph2', lexeme: 'maha', homograph: '2', senses: [{ glosses: { es: 'arena', en: 'sand' } }] })

// 15 — ALL orthographies populated (default "Practical" + ipa + script — the dev
// catalog row registers these, see seed-dev-fixture.ts)
add_entry({
  id: 'demo_multi_ortho',
  lexeme: { default: 'tzuk', ipa: 'tsʼuk', script: 'ꕚꖴ' },
  phonetic: 'tsʼuk',
  senses: [{ glosses: { es: 'estómago', en: 'stomach' } }],
})

// 16 — NO default orthography: alternates only (get_headword must promote the
// first populated alternate to full headword position — not look "lesser")
add_entry({
  id: 'demo_no_default',
  lexeme: { ipa: 'aχmak', script: 'ꖸꕒ' },
  senses: [{ glosses: { es: 'fuego', en: 'fire' } }],
})

db.close()
console.info(`✓ seeded demo_* variety entries into ${DICTIONARY_ID}.db — browse http://localhost:3041/${DICTIONARY_ID}/entries`)
