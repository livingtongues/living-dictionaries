import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { error, redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'

/**
 * DEV-ONLY local media store. With no GCS bucket on dev, `/api/upload` hands the
 * client a PUT url here instead of a presigned GCS url; the bytes land in
 * `<DATA_DIR>/dev-media/<path>` and are served back by GET so you can see/play
 * your real upload. When a requested file isn't local (e.g. existing pulled-dict
 * audio/video, which lives in the bucket we don't have), GET 302-redirects to a
 * bundled dummy so the UI degrades gracefully. Compiled out of prod builds via
 * the `import.meta.env.DEV` guard; never creates `dev-media/` in prod.
 */

function media_dir(): string {
  return join(process.env.DATA_DIR || '.data', 'dev-media')
}

/** Reject path traversal; keep within dev-media/. */
function safe_join(path: string): string {
  const root = media_dir()
  const full = join(root, path)
  if (!full.startsWith(`${root}/`) && full !== root)
    error(ResponseCodes.BAD_REQUEST, 'Invalid path')
  return full
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  oga: 'audio/ogg',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
}

function extension(path: string): string {
  return path.split('.').pop()?.toLowerCase() ?? ''
}

function content_type(path: string): string {
  const ext = extension(path)
  if (ext === 'webm')
    return path.includes('/videos/') ? 'video/webm' : 'audio/webm'
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}

function dummy_for(path: string): string {
  const ext = extension(path)
  if (path.includes('/videos/') || ext === 'mp4' || ext === 'mov')
    return '/dev-placeholder-video.mp4'
  if (path.includes('/images/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext))
    return '/dev-placeholder-image.svg'
  return '/dev-placeholder-audio.mp3'
}

export const GET: RequestHandler = ({ params }) => {
  if (!import.meta.env.DEV)
    error(ResponseCodes.NOT_FOUND, 'Not found')

  const { path } = params
  const full = safe_join(path)
  if (!existsSync(full))
    redirect(ResponseCodes.TEMPORARY_REDIRECT, dummy_for(path))

  return new Response(new Uint8Array(readFileSync(full)), {
    headers: {
      'content-type': content_type(path),
      'cache-control': 'no-cache',
    },
  })
}

export const PUT: RequestHandler = async ({ params, request }) => {
  if (!import.meta.env.DEV)
    error(ResponseCodes.NOT_FOUND, 'Not found')

  const full = safe_join(params.path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, Buffer.from(await request.arrayBuffer()))
  return new Response(null, { status: ResponseCodes.OK })
}
