import { ResponseCodes } from '@living-dictionaries/site/src/lib/constants'
import type { MultiString } from '@living-dictionaries/types'
import type { Database, TablesInsert } from '@living-dictionaries/site/src/lib/supabase/generated.types'

export interface ContentUpdateRequestBody {
  id: string // id of the change, a uuidv4 created on client to make things idempotent
  user_id_from_local?: string
  auth_token: string
  dictionary_id: string
  entry_id?: string
  sense_id?: string
  sentence_id?: string
  text_id?: string
  audio_id?: string
  video_id?: string
  photo_id?: string
  speaker_id?: string
  table: Database['public']['Enums']['content_tables']
  change: {
    sense?: {
      glosses?: {
        new: MultiString
        old?: MultiString
      }
      definition?: {
        new: MultiString
        old?: MultiString
      }
      noun_class?: {
        new: string
        old?: string
      }
      parts_of_speech?: {
        new: string[]
        old?: string[]
      }
      semantic_domains?: {
        new: string[]
        old?: string[]
      }
      write_in_semantic_domains?: {
        new: string[]
        old?: string[]
      }
      deleted?: boolean
    }
    sentence?: {
      text?: {
        new: MultiString
        old?: MultiString
      }
      translation?: {
        new: MultiString
        old?: MultiString
      }
      removed_from_sense?: boolean // currently also deletes the sentence - later when a sentence can be connected to multiple sentences, use a deleted field to indicate the sentence is deleted everywhere
      // deleted?: boolean;
    }
  }
  import_id?: string
  timestamp: string
}

export type ContentUpdateResponseBody = TablesInsert<'content_updates'>

type Return<ExpectedResponse> = {
  data: ExpectedResponse
  error: null
} | {
  data: null
  error: { status: number, message: string }
}

const default_headers: RequestInit['headers'] = {
  'content-type': 'application/json',
}

export async function post_request<T extends Record<string, any>, ExpectedResponse extends Record<string, any>>(route: string, data: T, options?: {
  fetch?: typeof fetch
  headers?: RequestInit['headers']
}): Promise<Return<ExpectedResponse>> {
  const fetch_to_use = options?.fetch || fetch

  const response = await fetch_to_use(route, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: options?.headers || default_headers,
  })

  return handleResponse<ExpectedResponse>(response)
}

async function handleResponse<ExpectedResponse extends Record<string, any>>(response: Response): Promise<Return<ExpectedResponse>> {
  const { status } = response
  if (status !== ResponseCodes.OK) {
    const responseClone = response.clone()
    try {
      try {
        const body = await response.json()
        const error = { status, message: body.message || JSON.stringify(body) }
        return { data: null, error }
      } catch {
        const textBody = await responseClone.text()
        return { data: null, error: { status, message: textBody } }
      }
    } catch (err) {
      return { data: null, error: { status, message: err.message } }
    }
  }
}
