/**
 * Complete media inventories straight from the dict DB (not the entries view),
 * so audio on sentences/texts and every photo/video row is included. Deletes
 * are hard in dict DBs, so every row is live.
 */

interface MediaQueryConnection {
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
}

export interface MediaFile {
  /** `storage_path` as stored — also the tail of the serving URL. */
  storage_path: string
  url: string
  /** Basename of `storage_path` — unique under the R2 `{dict}/{type}/{uuid}.{ext}` convention. */
  filename: string
}

export interface MediaInventory {
  images: MediaFile[]
  audio: MediaFile[]
  videos: MediaFile[]
}

export async function get_media_inventory({ connection, url_from_storage_path }: {
  connection: MediaQueryConnection
  url_from_storage_path: (path: string) => string
}): Promise<MediaInventory> {
  const to_file = ({ storage_path }: { storage_path: string }): MediaFile => ({
    storage_path,
    url: url_from_storage_path(storage_path),
    filename: storage_path.split('/').pop(),
  })
  const [images, audio, videos] = await Promise.all([
    connection.query<{ storage_path: string }>('SELECT storage_path FROM photos ORDER BY created_at'),
    connection.query<{ storage_path: string }>('SELECT storage_path FROM audio ORDER BY created_at'),
    connection.query<{ storage_path: string }>('SELECT storage_path FROM videos WHERE storage_path IS NOT NULL ORDER BY created_at'),
  ])
  return {
    images: images.map(to_file),
    audio: audio.map(to_file),
    videos: videos.map(to_file),
  }
}
