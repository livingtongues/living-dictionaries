import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { describe, expect, test } from 'vitest'
import { generate_video_thumbnail } from './video-thumbnails'

const ffmpeg_available = spawnSync('ffmpeg', ['-version']).status === 0
const fixture_path = fileURLToPath(new URL('../../../static/dev-placeholder-video.mp4', import.meta.url))

describe(generate_video_thumbnail, () => {
  test.runIf(ffmpeg_available)('extracts a frame and renders a WebP thumbnail from a real video', async () => {
    const bytes = new Uint8Array(readFileSync(fixture_path))
    const thumb = await generate_video_thumbnail({ bytes })
    expect(thumb).not.toBeNull()
    const meta = await sharp(thumb).metadata()
    // The 320x240 fixture stays native — `withoutEnlargement` never upscales to the 400 cap.
    expect({ format: meta.format, width: meta.width, height: meta.height }).toEqual({ format: 'webp', width: 320, height: 240 })
  })

  test('returns null for bytes ffmpeg cannot decode as video', async () => {
    const thumb = await generate_video_thumbnail({ bytes: new Uint8Array([1, 2, 3, 4]) })
    expect(thumb).toBeNull()
  })
})
