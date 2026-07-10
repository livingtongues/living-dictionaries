/**
 * Pure media URL builders. Split from `media.ts` so they're unit-testable
 * without pulling in `$app/state` (via the dict-client `operations` import that
 * the upload helpers need).
 *
 * Dev media mock (no GCS bucket on dev): uploaded bytes live in the local
 * `/api/dev-media` store and are served back; existing pulled-dict audio/video
 * (which need the bucket) 302 to a bundled dummy from that same endpoint. Photos
 * keep using the public lh3 CDN, so real pulled photos still load with no bucket.
 */

/** DEV-only `serving_url` sentinel for an image uploaded with no bucket (bytes live in `/api/dev-media`). */
export const DEV_LOCAL_PREFIX = 'dev-local:'

export function url_from_storage_path(path: string, storage_bucket: string): string {
  if (import.meta.env.DEV)
    return `/api/dev-media/${path}`
  return `https://firebasestorage.googleapis.com/v0/b/${storage_bucket}/o/${encodeURIComponent(path)}?alt=media`
}

/**
 * Build an App Engine Images (lh3) `src` from a stored `serving_url` hash + an
 * lh3 size spec (the part after `=`, e.g. `s150-p`, `w900`, `s0`). A dev-uploaded
 * image (`dev-local:<key>`) is served from the local `/api/dev-media` store. An
 * empty hash renders the bundled placeholder on DEV only (useful for agents
 * testing without media); on prod it returns '' — callers must treat a missing
 * hash as "no image" (guard before rendering an <img>). Real hashes (incl.
 * pulled-dict photos) still go to the public lh3 CDN, so they load on dev with
 * no bucket.
 */
export function image_src(serving_url: string, size: string): string {
  if (serving_url?.startsWith(DEV_LOCAL_PREFIX))
    return `/api/dev-media/${serving_url.slice(DEV_LOCAL_PREFIX.length)}`
  if (!serving_url)
    return import.meta.env.DEV ? '/dev-placeholder-image.svg' : ''
  return `https://lh3.googleusercontent.com/${serving_url}=${size}`
}

if (import.meta.vitest) {
  test('image_src: real serving_url hash → public lh3 CDN (loads on dev with no bucket)', () => {
    expect(image_src('abc123', 's150-p')).toBe('https://lh3.googleusercontent.com/abc123=s150-p')
  })
  test('image_src: dev-local sentinel → local dev-media store', () => {
    expect(image_src(`${DEV_LOCAL_PREFIX}achi/images/s1/9.jpg`, 'w900')).toBe('/api/dev-media/achi/images/s1/9.jpg')
  })
  test('image_src: empty/missing hash → bundled placeholder (DEV only; vitest runs with DEV true — prod returns empty string)', () => {
    expect(image_src('', 's0')).toBe('/dev-placeholder-image.svg')
  })
  test('url_from_storage_path: dev routes through the local dev-media store', () => {
    // vitest runs with import.meta.env.DEV === true
    expect(url_from_storage_path('gta/audio/e1/1.mp3', 'some-bucket')).toBe('/api/dev-media/gta/audio/e1/1.mp3')
  })
}
