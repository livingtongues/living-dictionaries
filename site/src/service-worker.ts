// Disciplined network-first service worker.
//
// THE RULES (so we never trap fast-iterating users a version behind):
//  - Navigations / data: NETWORK-FIRST — fresh online, cache only as an offline
//    fallback. Never cache-first for HTML, never stale-while-revalidate.
//  - Hashed build assets (/_app/immutable/*): cache-first is safe — a new deploy
//    changes the URL, so stale code can never be served.
//  - Stable static files (icons, fonts, manifest): precached for offline; can
//    lag one reload on change — acceptable, they're not code.
//  - /api/* + cross-origin: NETWORK-ONLY — never cached.
//  - activate: delete every non-current cache (this also wipes the OLD Vercel
//    app's `cache-*` / `offline*` caches at cutover) + skipWaiting + claim, so
//    shipping this file replaces the legacy zombie SW cleanly.
//
// Long-open tabs are nudged to reload by kit.version.pollInterval → the root
// layout's "new version" toast; this SW handles asset freshness.

/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker'

const sw = self as unknown as ServiceWorkerGlobalScope
const current_cache = `cache-${version}`
const SUCCESS = 200

// Content-hashed build output + stable static files. `dev-placeholder-*` assets
// are dev-only (DATA_DIR dev media) — excluded so they don't bloat the install.
const precached_assets = [
  ...build,
  ...prerendered,
  ...files.filter(file => !file.includes('dev-placeholder')),
]
const precached = new Set(precached_assets)

sw.addEventListener('install', (event) => {
  event.waitUntil(add_files_to_cache())
})

async function add_files_to_cache() {
  const cache = await caches.open(current_cache)
  await cache.addAll(precached_assets)
  sw.skipWaiting()
}

sw.addEventListener('activate', (event) => {
  event.waitUntil(delete_old_caches())
})

async function delete_old_caches() {
  const keys = await caches.keys()
  await Promise.all(keys.map(key => (key === current_cache ? null : caches.delete(key))))
  await sw.clients.claim()
}

sw.addEventListener('fetch', (event) => {
  const is_not_get = event.request.method !== 'GET'
  const is_partial = event.request.headers.has('range') // media/video
  if (is_not_get || is_partial)
    return

  const url = new URL(event.request.url)

  // Only same-origin http(s); let the browser handle cross-origin (GCS media, etc.).
  if (!url.protocol.startsWith('http') || url.origin !== sw.location.origin)
    return

  const { pathname } = url

  // Hashed build assets + immutable static files: safe to serve cache-first.
  if (precached.has(pathname))
    return event.respondWith(serve_precached(pathname))

  // API/data: never served from cache.
  if (pathname.startsWith('/api/'))
    return

  // Everything else (navigations): network-first with offline fallback.
  event.respondWith(network_first(event))
})

async function serve_precached(pathname: string): Promise<Response> {
  const cache = await caches.open(current_cache)
  const cached = await cache.match(pathname)
  return cached ?? fetch(pathname)
}

async function network_first(event: FetchEvent): Promise<Response> {
  const cache = await caches.open(current_cache)
  try {
    const response = await fetch(event.request)
    if (response.status === SUCCESS)
      cache.put(event.request, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(event.request)
    if (cached)
      return cached
    throw error
  }
}
