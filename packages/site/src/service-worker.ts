/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, prerendered, version } from '$service-worker'

// eslint-disable-next-line no-restricted-globals
const _self = self as unknown as ServiceWorkerGlobalScope
const current_cache = `cache-${version}`

const assets_for_cache = [
  ...build,
  ...prerendered,
  ...files,
]
const cached = new Set(assets_for_cache)

_self.addEventListener('install', (event) => {
  event.waitUntil(addFilesToCache())
})

async function addFilesToCache() {
  const cache = await caches.open(current_cache)
  await cache.addAll(assets_for_cache)
  _self.skipWaiting()
}

_self.addEventListener('activate', (event) => {
  event.waitUntil(deleteOldCaches())
})

async function deleteOldCaches() {
  const cacheNames = await caches.keys()
  const deletionPromises = cacheNames.map((name) => {
    if (name !== current_cache)
      return caches.delete(name)
    return null
  })
  await Promise.all(deletionPromises)
  _self.clients.claim()
}

_self.addEventListener('fetch', (event) => {
  const isNotGetRequest = event.request.method !== 'GET'
  const isPartialRequest = event.request.headers.has('range') // as in videos
  if (isNotGetRequest || isPartialRequest)
    return

  const url = new URL(event.request.url)

  // don't try to handle e.g. data: URIs
  if (!url.protocol.startsWith('http')) return

  // ignore dev server requests
  if (url.hostname === _self.location.hostname && url.port !== _self.location.port) return

  // always serve static files and bundler-generated assets from cache
  if (url.host === _self.location.host && cached.has(url.pathname)) {
    // @ts-expect-error
    event.respondWith(caches.match(event.request))
    return
  }

  if (event.request.cache === 'only-if-cached') return

  // for everything else, try the network first, falling back to
  // cache if the user is offline. (If the pages never change, you
  // might prefer a cache-first approach to a network-first one.)
  event.respondWith(
    caches.open(`offline${version}`).then(async (cache) => {
      try {
        const response = await fetch(event.request)
        cache.put(event.request, response.clone())
        return response
      } catch (err) {
        const response = await cache.match(event.request)
        if (response) return response

        throw err
      }
    }),
  )
})
