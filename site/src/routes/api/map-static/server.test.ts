import { mkdtempSync, readdirSync, rmSync, statSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { GET } from './+server'

let data_dir: string
const fetch_mock = vi.fn()

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4E, 0x47]).buffer

function mapbox_ok() {
  return { ok: true, arrayBuffer: () => Promise.resolve(PNG_BYTES.slice(0)) }
}

function call(params: Record<string, string>) {
  const url = new URL(`http://localhost/api/map-static?${new URLSearchParams(params)}`)
  return GET({ url } as unknown as Parameters<typeof GET>[0])
}

const one_point = JSON.stringify([{ coordinates: { longitude: 120.5, latitude: 30.25 } }])
const one_region = JSON.stringify([{ coordinates: [
  { longitude: 10, latitude: 10 },
  { longitude: 11, latitude: 10 },
  { longitude: 11, latitude: 11 },
] }])

function cached_files() {
  return readdirSync(path.join(data_dir, 'cache', 'map-static'))
}

beforeEach(() => {
  data_dir = mkdtempSync(path.join(tmpdir(), 'map-static-test-'))
  process.env.DATA_DIR = data_dir
  process.env.MAPBOX_ACCESS_TOKEN = 'pk.test-token'
  vi.stubGlobal('fetch', fetch_mock)
  fetch_mock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  rmSync(data_dir, { recursive: true, force: true })
  delete process.env.MAPBOX_ACCESS_TOKEN
})

describe(GET, () => {
  test('404 when no real token is configured', async () => {
    process.env.MAPBOX_ACCESS_TOKEN = 'dummy'
    await expect(call({ points: one_point })).rejects.toMatchObject({ status: 404 })
  })

  test('400 without points or regions', async () => {
    await expect(call({})).rejects.toMatchObject({ status: 400 })
  })

  test('400 on malformed points JSON', async () => {
    await expect(call({ points: 'not-json' })).rejects.toMatchObject({ status: 400 })
  })

  test('400 on non-numeric coordinates', async () => {
    const bad = JSON.stringify([{ coordinates: { longitude: 'east', latitude: 30 } }])
    await expect(call({ points: bad })).rejects.toMatchObject({ status: 400 })
  })

  test('400 on a region with fewer than 3 coordinates', async () => {
    const bad = JSON.stringify([{ coordinates: [{ longitude: 1, latitude: 1 }] }])
    await expect(call({ regions: bad })).rejects.toMatchObject({ status: 400 })
  })

  test('cache miss fetches mapbox, writes the cache, and serves the image', async () => {
    fetch_mock.mockResolvedValueOnce(mapbox_ok())
    const response = await call({ points: one_point, w: '640', h: '320', mode: 'dark', zoom: '5' })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('cache-control')).toBe('public, max-age=2592000, immutable')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(PNG_BYTES))
    expect(fetch_mock).toHaveBeenCalledTimes(1)
    const mapbox_url = fetch_mock.mock.calls[0][0] as string
    expect(mapbox_url).toContain('/styles/v1/mapbox/dark-v11/static/')
    expect(mapbox_url).toContain('/120.5,30.25,5/640x320@2x?logo=false&access_token=pk.test-token')
    expect(cached_files()).toHaveLength(1)
  })

  test('multi-feature request uses auto viewport', async () => {
    fetch_mock.mockResolvedValueOnce(mapbox_ok())
    await call({ points: one_point, regions: one_region })
    expect(fetch_mock.mock.calls[0][0]).toContain('/auto/300x200@2x')
  })

  test('cache hit serves from disk without touching mapbox', async () => {
    fetch_mock.mockResolvedValueOnce(mapbox_ok())
    await call({ points: one_point })
    const response = await call({ points: one_point })
    expect(response.status).toBe(200)
    expect(fetch_mock).toHaveBeenCalledTimes(1)
  })

  test('expired cache refetches from mapbox', async () => {
    fetch_mock.mockResolvedValue(mapbox_ok())
    await call({ points: one_point })
    const [file] = cached_files()
    const cache_path = path.join(data_dir, 'cache', 'map-static', file)
    const expired = (Date.now() - 31 * 24 * 60 * 60 * 1000) / 1000
    utimesSync(cache_path, expired, expired)
    await call({ points: one_point })
    expect(fetch_mock).toHaveBeenCalledTimes(2)
    expect(statSync(cache_path).mtimeMs).toBeGreaterThan(Date.now() - 60 * 1000) // eslint-disable-line no-restricted-syntax -- freshness range check
  })

  test('serves a stale cache copy when mapbox is unreachable', async () => {
    fetch_mock.mockResolvedValueOnce(mapbox_ok())
    await call({ points: one_point })
    const [file] = cached_files()
    const cache_path = path.join(data_dir, 'cache', 'map-static', file)
    const expired = (Date.now() - 31 * 24 * 60 * 60 * 1000) / 1000
    utimesSync(cache_path, expired, expired)
    fetch_mock.mockRejectedValueOnce(new Error('network down'))
    const response = await call({ points: one_point })
    expect(response.status).toBe(200)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(PNG_BYTES))
  })

  test('502 when mapbox fails and nothing is cached', async () => {
    fetch_mock.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(call({ points: one_point })).rejects.toMatchObject({ status: 502 })
  })

  test('clamps oversized dimensions to the mapbox limit', async () => {
    fetch_mock.mockResolvedValueOnce(mapbox_ok())
    await call({ points: one_point, w: '99999', h: '10' })
    expect(fetch_mock.mock.calls[0][0]).toContain('/1280x50@2x')
  })
})
