import { browser } from '$app/environment'

/**
 * Lightweight most-recent-first visit history powering the homepage quick-jump
 * pills for visitors without their own dictionaries. Written from the
 * dictionary layout on each dict open.
 */

const STORAGE_KEY = 'visited_dictionaries'
const MAX_VISITED = 10

export interface VisitedDict {
  id: string
  url: string
  name: string
}

export function get_visited_dicts(): VisitedDict[] {
  if (!browser)
    return []
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function record_visited_dict({ id, url, name }: VisitedDict) {
  if (!browser || !id || !url)
    return
  const list = get_visited_dicts().filter(visited => visited.id !== id)
  list.unshift({ id, url, name })
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_VISITED)))
  } catch { /* storage full/blocked — history is best-effort */ }
}
