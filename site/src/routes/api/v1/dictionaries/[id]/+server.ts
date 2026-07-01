import type { RequestHandler } from './$types'
import type { DictionaryCoordinates, Orthography } from '$lib/db/schemas/shared.types'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { json } from '@sveltejs/kit'

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

  return json({
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
  } satisfies V1DictionaryResponseBody)
}
