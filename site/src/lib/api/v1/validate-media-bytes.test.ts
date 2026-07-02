import { describe, expect, test } from 'vitest'
import { sniff_bytes, validate_media_bytes } from './validate-media-bytes'

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values)
}

function ascii(text: string, tail: number[] = []): Uint8Array {
  return new Uint8Array([...[...text].map(c => c.charCodeAt(0)), ...tail])
}

// Minimal real-format headers (bytes beyond the signature are padding).
const PNG = bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0)
const JPEG = bytes(0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0)
const GIF = ascii('GIF89a', [0x01, 0x00, 0x01, 0x00])
const WAV = ascii('RIFF', [0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]) // ...WAVE
const WEBP = ascii('RIFF', [0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]) // ...WEBP
const MP3_ID3 = ascii('ID3', [0x03, 0x00, 0x00, 0x00])
const MP3_SYNC = bytes(0xFF, 0xFB, 0x90, 0x00)
const FLAC = ascii('fLaC', [0x00, 0x00, 0x00, 0x22])
const MP4 = bytes(0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D) // ftyp isom
const M4A = bytes(0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4D, 0x34, 0x41, 0x20) // ftyp M4A
const WEBM = bytes(0x1A, 0x45, 0xDF, 0xA3, 0, 0, 0, 0)
const OGG = ascii('OggS', [0x00, 0x02, 0x00, 0x00])

const HTML = ascii('<!DOCTYPE html><html><head><title>404 Not Found</title>')
const HTML_BARE = ascii('<html lang="en"><body>nope</body></html>')
const SVG = ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
const JSON_BODY = ascii('{"error":"not found"}')
const PDF = ascii('%PDF-1.7\n%âãÏÓ')
const PLAIN = ascii('Sorry, that page could not be found.')

describe(sniff_bytes, () => {
  test('identifies media containers with category', () => {
    expect(sniff_bytes(PNG)).toEqual({ kind: 'media', category: 'image' })
    expect(sniff_bytes(JPEG)).toEqual({ kind: 'media', category: 'image' })
    expect(sniff_bytes(GIF)).toEqual({ kind: 'media', category: 'image' })
    expect(sniff_bytes(WEBP)).toEqual({ kind: 'media', category: 'image' })
    expect(sniff_bytes(WAV)).toEqual({ kind: 'media', category: 'audio' })
    expect(sniff_bytes(MP3_ID3)).toEqual({ kind: 'media', category: 'audio' })
    expect(sniff_bytes(MP3_SYNC)).toEqual({ kind: 'media', category: 'audio' })
    expect(sniff_bytes(FLAC)).toEqual({ kind: 'media', category: 'audio' })
    expect(sniff_bytes(MP4)).toEqual({ kind: 'media', category: 'video' })
    expect(sniff_bytes(M4A)).toEqual({ kind: 'media', category: 'audio' })
  })

  test('flags category-ambiguous containers as media, naming the container', () => {
    expect(sniff_bytes(WEBM)).toEqual({ kind: 'media', container: 'Matroska/WebM' })
    expect(sniff_bytes(OGG)).toEqual({ kind: 'media', container: 'Ogg' })
  })

  test('identifies non-media text formats', () => {
    expect(sniff_bytes(HTML).kind).toBe('html')
    expect(sniff_bytes(HTML_BARE).kind).toBe('html')
    expect(sniff_bytes(SVG).kind).toBe('xml')
    expect(sniff_bytes(JSON_BODY).kind).toBe('json')
    expect(sniff_bytes(PDF).kind).toBe('pdf')
    expect(sniff_bytes(PLAIN).kind).toBe('text')
  })
})

describe(validate_media_bytes, () => {
  test('accepts matching media', () => {
    expect(validate_media_bytes({ category: 'image', declared_type: 'image/png', bytes: PNG })).toEqual({ ok: true })
    expect(validate_media_bytes({ category: 'audio', declared_type: 'audio/wav', bytes: WAV })).toEqual({ ok: true })
    expect(validate_media_bytes({ category: 'video', declared_type: 'video/mp4', bytes: MP4 })).toEqual({ ok: true })
  })

  test('rejects an HTML error page fetched as audio (the reported bug)', () => {
    const result = validate_media_bytes({ category: 'audio', declared_type: 'text/html; charset=utf-8', bytes: HTML })
    expect(result.ok).toBeFalsy()
    expect(result).toMatchObject({ reason: expect.stringContaining('HTML') })
  })

  test('rejects HTML even when the server mislabels it as media', () => {
    // Lying content-type (audio/mpeg) but the bytes are HTML → magic sniff catches it.
    expect(validate_media_bytes({ category: 'audio', declared_type: 'audio/mpeg', bytes: HTML }).ok).toBeFalsy()
  })

  test('rejects JSON, PDF, SVG, and plain text', () => {
    expect(validate_media_bytes({ category: 'image', declared_type: 'application/json', bytes: JSON_BODY }).ok).toBeFalsy()
    expect(validate_media_bytes({ category: 'image', declared_type: 'application/pdf', bytes: PDF }).ok).toBeFalsy()
    expect(validate_media_bytes({ category: 'image', declared_type: 'image/svg+xml', bytes: SVG }).ok).toBeFalsy()
    expect(validate_media_bytes({ category: 'audio', declared_type: 'text/plain', bytes: PLAIN }).ok).toBeFalsy()
  })

  test('rejects a cross-category media file (image to an audio endpoint)', () => {
    expect(validate_media_bytes({ category: 'audio', declared_type: 'image/png', bytes: PNG }).ok).toBeFalsy()
  })

  test('rejects on a conflicting declared type even when bytes are generic', () => {
    // Unknown/ambiguous bytes but the server declared text/html → declared-type backstop.
    expect(validate_media_bytes({ category: 'audio', declared_type: 'text/html', bytes: WEBM }).ok).toBeFalsy()
  })

  test('accepts real media served with a generic octet-stream content-type', () => {
    expect(validate_media_bytes({ category: 'audio', declared_type: 'application/octet-stream', bytes: MP3_SYNC })).toEqual({ ok: true })
    expect(validate_media_bytes({ category: 'audio', declared_type: null, bytes: FLAC })).toEqual({ ok: true })
  })

  test('rejects empty bytes', () => {
    expect(validate_media_bytes({ category: 'image', declared_type: 'image/png', bytes: new Uint8Array() }).ok).toBeFalsy()
  })

  // Ambiguous audio/video containers (Ogg, Matroska/WebM) carry no resolvable
  // category, so before the fix an octet-stream body slipped past the image
  // endpoint and a WebM/Ogg could be stored AS a photo. They must be rejected on
  // the image endpoint but still accepted on audio/video (can't disambiguate).
  describe('ambiguous container × endpoint matrix (Ogg / WebM)', () => {
    test('image endpoint REJECTS a WebM/Ogg under a generic octet-stream type (the reported bug)', () => {
      expect(validate_media_bytes({ category: 'image', declared_type: 'application/octet-stream', bytes: WEBM }).ok).toBeFalsy()
      expect(validate_media_bytes({ category: 'image', declared_type: 'application/octet-stream', bytes: OGG }).ok).toBeFalsy()
    })

    test('image endpoint REJECTS a WebM/Ogg even with no declared type', () => {
      expect(validate_media_bytes({ category: 'image', declared_type: null, bytes: WEBM }).ok).toBeFalsy()
      expect(validate_media_bytes({ category: 'image', declared_type: undefined, bytes: OGG }).ok).toBeFalsy()
    })

    test('image rejection names the container', () => {
      expect(validate_media_bytes({ category: 'image', declared_type: 'application/octet-stream', bytes: WEBM }))
        .toMatchObject({ reason: expect.stringContaining('Matroska/WebM') })
      expect(validate_media_bytes({ category: 'image', declared_type: 'application/octet-stream', bytes: OGG }))
        .toMatchObject({ reason: expect.stringContaining('Ogg') })
    })

    test('audio + video endpoints ACCEPT the same ambiguous containers', () => {
      expect(validate_media_bytes({ category: 'audio', declared_type: 'application/octet-stream', bytes: WEBM })).toEqual({ ok: true })
      expect(validate_media_bytes({ category: 'video', declared_type: 'application/octet-stream', bytes: WEBM })).toEqual({ ok: true })
      expect(validate_media_bytes({ category: 'audio', declared_type: 'application/octet-stream', bytes: OGG })).toEqual({ ok: true })
      expect(validate_media_bytes({ category: 'video', declared_type: 'application/octet-stream', bytes: OGG })).toEqual({ ok: true })
    })
  })
})
