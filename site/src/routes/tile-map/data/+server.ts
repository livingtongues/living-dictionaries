import { open, stat } from 'node:fs/promises'
import path from 'node:path'
import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

// Serves the local PMTiles extract with HTTP Range support (vite's static server
// answers range requests with 200 + full body, which the pmtiles client rejects).
// Tracer-bullet only — the real tileset will live on R2 where range + CORS are native.

const MAX_CHUNK_BYTES = 32 * 1024 * 1024

export const GET: RequestHandler = async ({ request }) => {
  const file_path = path.join(process.env.DATA_DIR || '.data', 'tiles', 'planet-z6.pmtiles')
  let file_stat
  try {
    file_stat = await stat(file_path)
  } catch {
    error(404, 'tile archive missing — extract it per .issues/tile-map-tracer.md')
  }

  const range = request.headers.get('range')
  const match = range && /^bytes=(?<start>\d+)-(?<end>\d+)?$/.exec(range)
  if (!match) error(400, 'range request required')

  const start = Number(match.groups.start)
  const requested_end = match.groups.end ? Number(match.groups.end) : start + MAX_CHUNK_BYTES - 1
  const end = Math.min(requested_end, file_stat.size - 1, start + MAX_CHUNK_BYTES - 1)
  if (start > end || start >= file_stat.size) error(416, 'range not satisfiable')

  const length = end - start + 1
  const handle = await open(file_path)
  try {
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, start)
    return new Response(new Uint8Array(buffer), {
      status: 206,
      headers: {
        'content-range': `bytes ${start}-${end}/${file_stat.size}`,
        'accept-ranges': 'bytes',
        'content-length': String(length),
        'content-type': 'application/octet-stream',
        'etag': `"pmtiles-${file_stat.size}-${file_stat.mtimeMs}"`,
        'cache-control': 'no-store',
      },
    })
  } finally {
    await handle.close()
  }
}
