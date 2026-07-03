import type { RequestHandler } from './$types'
import { get_shared_db } from '$lib/db/server/shared-db'
import { export_locale_files } from '$lib/server/i18n/export'
import { json } from '@sveltejs/kit'

/**
 * Full non-English translation set, shaped like the committed
 * `$lib/i18n/locales/**` files. PUBLIC — this data ships inside the client
 * bundle anyway. The Dockerfile bake step (`site/scripts/fetch-baked-i18n.mjs`)
 * fetches this from the running prod site during `docker compose build` so
 * every deploy bakes the latest DB values; also handy for a dev refresh
 * (`pnpm i18n:refresh`).
 */
export const GET: RequestHandler = () => {
  const db = get_shared_db()
  return json(export_locale_files({ db }))
}
