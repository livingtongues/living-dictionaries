import type { Tables } from '$lib/types'

export function find_existing_source({
  sources,
  slug,
  source_id,
}: {
  sources: Tables<'sources'>[]
  slug: string
  source_id?: string
}) {
  return sources.find(source => source.slug === slug && source.id !== source_id)
}

export function classify_source_save_failure(error: unknown): 'duplicate_slug' | 'write_failed' {
  const message = error instanceof Error ? error.message : String(error)
  return /UNIQUE constraint failed:\s*sources\.slug/i.test(message)
    ? 'duplicate_slug'
    : 'write_failed'
}

export async function commit_source({
  write,
  slug,
  on_saved,
  on_close,
}: {
  write: () => Promise<unknown>
  slug: string
  on_saved?: (source: { slug: string }) => void
  on_close: () => void
}): Promise<{ success: true } | { success: false, failure_kind: 'duplicate_slug' | 'write_failed' }> {
  try {
    await write()
    on_saved?.({ slug })
    on_close()
    return { success: true }
  } catch (error) {
    return { success: false, failure_kind: classify_source_save_failure(error) }
  }
}
