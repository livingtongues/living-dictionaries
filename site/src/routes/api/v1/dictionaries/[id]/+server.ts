import type { RequestHandler } from './$types'
import type { DictionaryCoordinates, FeaturedImage, Orthography } from '$lib/db/schemas/shared.types'
import type { DictionaryRow } from '$lib/db/server/get-dictionary'
import { ResponseCodes } from '$lib/constants'
import { CatalogFieldError, update_dictionary_catalog, V1_CATALOG_FIELDS } from '$lib/db/server/dictionary-catalog'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { get_shared_db } from '$lib/db/server/shared-db'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export interface V1DictionaryResponseBody {
  id: string
  url: string | null
  name: string
  alternate_names: string[] | null
  /** Valid gloss-language codes to key `glosses` / `translation` maps by. */
  gloss_languages: string[] | null
  orthographies: Orthography[] | null
  iso_639_3: string | null
  glottocode: string | null
  entry_count: number
  coordinates: DictionaryCoordinates | null
  public: boolean
  /** The home-page hero image, set via `POST …/cover-image`. */
  featured_image: FeaturedImage | null
}

function to_response_body(dictionary: DictionaryRow): V1DictionaryResponseBody {
  return {
    id: dictionary.id,
    url: dictionary.url,
    name: dictionary.name,
    alternate_names: dictionary.alternate_names ?? null,
    gloss_languages: dictionary.gloss_languages ?? null,
    orthographies: dictionary.orthographies ?? null,
    iso_639_3: dictionary.iso_639_3,
    glottocode: dictionary.glottocode,
    entry_count: dictionary.entry_count,
    coordinates: dictionary.coordinates ?? null,
    public: !!dictionary.public,
    featured_image: dictionary.featured_image ?? null,
  }
}

/**
 * GET /api/v1/dictionaries/[id]
 *
 * Dictionary metadata an agent needs before writing — chiefly `gloss_languages`
 * (which locale codes to key glosses/translations by) + `orthographies`. Key/
 * session gated (contributor+).
 */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })
  return json(to_response_body(dictionary))
}

/** Partial catalog update — every key must be in `V1_CATALOG_FIELDS`. */
export type V1DictionaryPatchRequestBody = Record<string, unknown>

/**
 * PATCH /api/v1/dictionaries/[id]
 *
 * Write the dictionary's own catalog metadata — the long-form `about` prose, the
 * `citation`, where it's spoken, language codes, copyright, collaborators. The
 * agent-side twin of the human settings/about tab, sharing its allowlist and
 * validation via `$lib/db/server/dictionary-catalog.ts`.
 *
 * Four things live behind their own doors instead: gloss languages
 * (`…/gloss-languages`), orthographies (`…/orthographies`), the cover image
 * (`…/cover-image`), and publication (`public` / `print_access` — a human call;
 * ask on the import conversation rather than flipping it).
 */
export const PATCH: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
  const body = await event.request.json().catch(() => {
    error(ResponseCodes.BAD_REQUEST, 'Invalid JSON body')
  }) as V1DictionaryPatchRequestBody

  try {
    update_dictionary_catalog({
      db: get_shared_db(),
      dictionary_id: dictionary.id,
      fields: body,
      user_id: access.user_id,
      allowed: V1_CATALOG_FIELDS,
    })
  } catch (err) {
    if (err instanceof CatalogFieldError)
      error(ResponseCodes.BAD_REQUEST, err.message)
    log_server_event({ level: 'error', message: 'v1_dictionary_catalog_update_failed', error: err, user_id: access.user_id, context: { dictionary_id: dictionary.id, fields: Object.keys(body) } })
    error(ResponseCodes.INTERNAL_SERVER_ERROR, 'Could not update dictionary')
  }

  log_server_event({ level: 'info', message: 'v1_dictionary_catalog_updated', user_id: access.user_id, context: { dictionary_id: dictionary.id, fields: Object.keys(body), via: access.via } })

  const updated = get_dictionary_by_url_or_id(dictionary.id) ?? dictionary
  return json(to_response_body(updated))
}
