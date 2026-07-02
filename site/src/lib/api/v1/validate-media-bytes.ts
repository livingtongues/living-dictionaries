/**
 * Server-side content validation for v1 media uploads. Both entry points into the
 * media pipeline — a multipart `file` and a server-fetched `{ url }` — flow through
 * here BEFORE the bytes are stored, so a URL that returns an HTML "not found" page
 * (HTTP 200) can never be saved AS audio/photo/video.
 *
 * Hybrid strategy: sniff the leading bytes to positively reject non-media
 * (HTML/XML/SVG/JSON/PDF/plain-text) or a cross-category media file, AND require the
 * DECLARED content-type's category to match — while treating generic types
 * (`application/octet-stream`, unlabeled) as unknown so obscure-but-valid audio
 * formats aren't false-rejected (the magic sniff is the backstop there).
 */

export type MediaCategory = 'audio' | 'image' | 'video'

type SniffKind = 'media' | 'html' | 'xml' | 'json' | 'pdf' | 'text' | 'unknown'

export interface SniffResult {
  kind: SniffKind
  /** Present when `kind === 'media'` and the container reveals its category. */
  category?: MediaCategory
  /**
   * Present when `kind === 'media'` but the container is category-AMBIGUOUS
   * (Ogg / Matroska-WebM / bare RIFF — all audio-or-video, NEVER image). Names
   * the container so a rejection reason can be specific, and lets the image
   * endpoint reject it (no image is delivered in one of these).
   */
  container?: string
}

export interface MediaValidation {
  ok: boolean
  /** Present when `ok` is false — an agent-readable rejection reason (route → 415). */
  reason?: string
}

function ascii_at(bytes: Uint8Array, offset: number, text: string): boolean {
  if (offset + text.length > bytes.length)
    return false
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i))
      return false
  }
  return true
}

function bytes_at(bytes: Uint8Array, signature: number[]): boolean {
  if (signature.length > bytes.length)
    return false
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i])
      return false
  }
  return true
}

/** Resolve an ISO-BMFF (`ftyp`) major brand to a category. Defaults to video. */
function ftyp_category(bytes: Uint8Array): MediaCategory {
  const brand = String.fromCharCode(bytes[8] ?? 0, bytes[9] ?? 0, bytes[10] ?? 0, bytes[11] ?? 0).toLowerCase()
  if (brand.startsWith('m4a') || brand.startsWith('m4b') || brand.startsWith('f4a'))
    return 'audio'
  return 'video'
}

/** Positively identify a known media container by magic bytes. */
export function sniff_media_magic(bytes: Uint8Array): SniffResult | null {
  // Images
  if (bytes_at(bytes, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    return { kind: 'media', category: 'image' } // PNG
  if (bytes_at(bytes, [0xFF, 0xD8, 0xFF]))
    return { kind: 'media', category: 'image' } // JPEG
  if (ascii_at(bytes, 0, 'GIF8'))
    return { kind: 'media', category: 'image' } // GIF
  if (ascii_at(bytes, 0, 'BM'))
    return { kind: 'media', category: 'image' } // BMP
  // RIFF containers (WebP=image, WAVE=audio, AVI=video) disambiguate at byte 8.
  if (ascii_at(bytes, 0, 'RIFF')) {
    if (ascii_at(bytes, 8, 'WEBP'))
      return { kind: 'media', category: 'image' }
    if (ascii_at(bytes, 8, 'WAVE'))
      return { kind: 'media', category: 'audio' }
    if (ascii_at(bytes, 8, 'AVI '))
      return { kind: 'media', category: 'video' }
    return { kind: 'media', container: 'RIFF' }
  }
  // Audio
  if (ascii_at(bytes, 0, 'ID3'))
    return { kind: 'media', category: 'audio' } // MP3 w/ ID3 tag
  if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)
    return { kind: 'media', category: 'audio' } // MPEG audio frame sync
  if (ascii_at(bytes, 0, 'fLaC'))
    return { kind: 'media', category: 'audio' } // FLAC
  if (ascii_at(bytes, 0, 'FORM') && (ascii_at(bytes, 8, 'AIFF') || ascii_at(bytes, 8, 'AIFC')))
    return { kind: 'media', category: 'audio' } // AIFF
  // OGG can carry audio (Vorbis/Opus/FLAC) or video (Theora) — ambiguous.
  if (ascii_at(bytes, 0, 'OggS'))
    return { kind: 'media', container: 'Ogg' }
  // ISO-BMFF (MP4 / MOV / M4A): 'ftyp' box at byte 4.
  if (ascii_at(bytes, 4, 'ftyp'))
    return { kind: 'media', category: ftyp_category(bytes) }
  // Matroska / WebM — ambiguous (usually video, can be audio-only).
  if (bytes_at(bytes, [0x1A, 0x45, 0xDF, 0xA3]))
    return { kind: 'media', container: 'Matroska/WebM' }
  return null
}

const BOM = [0xEF, 0xBB, 0xBF]

/** Byte offset of the first meaningful character, skipping a UTF-8 BOM + whitespace. */
function text_start(bytes: Uint8Array): number {
  let i = bytes_at(bytes, BOM) ? 3 : 0
  while (i < bytes.length) {
    const byte = bytes[i]
    if (byte === 0x20 || byte === 0x09 || byte === 0x0A || byte === 0x0D || byte === 0x0C)
      i++
    else break
  }
  return i
}

/** Positively identify a known non-media text format (HTML/XML/SVG/JSON/PDF). */
export function sniff_non_media(bytes: Uint8Array): SniffResult | null {
  if (ascii_at(bytes, 0, '%PDF-'))
    return { kind: 'pdf' }
  const start = text_start(bytes)
  const head = String.fromCharCode(...bytes.subarray(start, start + 14)).toLowerCase()
  if (head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('<head') || head.startsWith('<body') || head.startsWith('<!--'))
    return { kind: 'html' }
  if (head.startsWith('<?xml') || head.startsWith('<svg'))
    return { kind: 'xml' }
  if (bytes[start] === 0x7B) // '{'
    return { kind: 'json' }
  return null
}

/** Heuristic: the first bytes are all printable ASCII / whitespace (looks like text). */
function looks_like_text(bytes: Uint8Array): boolean {
  const window = Math.min(bytes.length, 32)
  if (window === 0)
    return false
  for (let i = 0; i < window; i++) {
    const byte = bytes[i]
    const printable = byte >= 0x20 && byte <= 0x7E
    const whitespace = byte === 0x09 || byte === 0x0A || byte === 0x0D || byte === 0x0C
    if (!printable && !whitespace)
      return false
  }
  return true
}

export function sniff_bytes(bytes: Uint8Array): SniffResult {
  const media = sniff_media_magic(bytes)
  if (media)
    return media
  const non_media = sniff_non_media(bytes)
  if (non_media)
    return non_media
  if (looks_like_text(bytes))
    return { kind: 'text' }
  return { kind: 'unknown' }
}

const KIND_LABEL: Record<Exclude<SniffKind, 'media' | 'unknown'>, string> = {
  html: 'an HTML page',
  xml: 'an XML/SVG document',
  json: 'a JSON document',
  pdf: 'a PDF',
  text: 'plain text',
}

/** True when the declared content-type names a category that conflicts with `category`. */
function declared_type_conflicts({ declared_type, category }: { declared_type: string | null | undefined, category: MediaCategory }): boolean {
  const type = (declared_type || '').split(';')[0].trim().toLowerCase()
  if (!type)
    return false
  const [top] = type.split('/')
  if (top === 'audio' || top === 'image' || top === 'video')
    return top !== category
  if (top === 'text')
    return true
  if (type === 'application/json' || type === 'application/ld+json' || type === 'application/xml' || type === 'application/xhtml+xml' || type === 'application/pdf')
    return true
  // application/octet-stream and other generic application/* → unknown, allowed.
  return false
}

/**
 * Validate that `bytes` (optionally with a `declared_type` content-type) really are
 * `category` media. Returns `{ ok: false, reason }` on a rejection the route maps to
 * 415; `{ ok: true }` when the content is media-consistent (or generically labeled +
 * not sniffed as non-media).
 */
export function validate_media_bytes({ category, declared_type, bytes }: {
  category: MediaCategory
  declared_type?: string | null
  bytes: Uint8Array
}): MediaValidation {
  if (!bytes.length)
    return { ok: false, reason: 'The provided media is empty.' }

  const sniff = sniff_bytes(bytes)
  if (sniff.kind !== 'media' && sniff.kind !== 'unknown') {
    return { ok: false, reason: `The provided data looks like ${KIND_LABEL[sniff.kind]}, not ${category}. If you passed a "url", it probably returned an error page instead of a media file.` }
  }
  if (sniff.kind === 'media' && sniff.category && sniff.category !== category) {
    return { ok: false, reason: `The provided data is ${sniff.category}, but this endpoint expects ${category}.` }
  }
  // A category-AMBIGUOUS media container (Ogg / Matroska-WebM / bare RIFF) is
  // always audio-or-video, never an image — so it must NOT pass the image
  // endpoint even under a generic declared type (`application/octet-stream`),
  // which was letting a WebM/Ogg be stored as a photo. Audio/video endpoints
  // keep accepting these (they genuinely can't be disambiguated by magic bytes).
  if (category === 'image' && sniff.kind === 'media' && !sniff.category) {
    const container = sniff.container ? `a ${sniff.container} container` : 'an audio/video container'
    return { ok: false, reason: `The provided data is ${container}, which is audio/video, not an image.` }
  }
  if (declared_type_conflicts({ declared_type, category })) {
    return { ok: false, reason: `The content-type "${declared_type}" is not ${category}.` }
  }
  return { ok: true }
}
