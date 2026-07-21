import type { V1FilePostRequestBody, V1FilePostResponseBody, V1FilesGetResponseBody } from './+server'
import type { V1FilePatchRequestBody, V1FilePatchResponseBody } from './[file_id]/+server'
import type { V1FileConfirmResponseBody } from './[file_id]/confirm/+server'
import type { V1FilesRequestImportRequestBody, V1FilesRequestImportResponseBody } from './request-import/+server'
import type { V1ImportRequestPatchRequestBody, V1ImportRequestPatchResponseBody } from './requests/[thread_id]/+server'
import { ResponseCodes } from '$lib/constants'
import { get_request, post_request } from '$lib/utils/requests'

/** Session-cookie clients (the import + sources pages). Agents hit the same endpoints with a Bearer key. */

export async function api_dict_files_list({ dictionary_id }: { dictionary_id: string }) {
  return await get_request<V1FilesGetResponseBody>(`/api/v1/dictionaries/${dictionary_id}/files`)
}

export async function api_dict_files_register({ dictionary_id, ...body }: { dictionary_id: string } & V1FilePostRequestBody) {
  return await post_request<V1FilePostRequestBody, V1FilePostResponseBody>(`/api/v1/dictionaries/${dictionary_id}/files`, body)
}

export async function api_dict_file_confirm({ dictionary_id, file_id }: { dictionary_id: string, file_id: string }) {
  return await post_request<Record<string, never>, V1FileConfirmResponseBody>(`/api/v1/dictionaries/${dictionary_id}/files/${file_id}/confirm`, {})
}

export async function api_dict_file_update({ dictionary_id, file_id, ...body }: { dictionary_id: string, file_id: string } & V1FilePatchRequestBody) {
  try {
    const response = await fetch(`/api/v1/dictionaries/${dictionary_id}/files/${file_id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })
    if (response.status !== ResponseCodes.OK) {
      const message = await response.text()
      return { data: null, error: { status: response.status, message } }
    }
    const data = await response.json() as V1FilePatchResponseBody
    return { data, error: null }
  } catch (err) {
    return { data: null, error: { status: 0, message: (err as Error).message } }
  }
}

export async function api_dict_file_delete({ dictionary_id, file_id }: { dictionary_id: string, file_id: string }) {
  try {
    const response = await fetch(`/api/v1/dictionaries/${dictionary_id}/files/${file_id}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
    })
    if (response.status !== ResponseCodes.OK) {
      const message = await response.text()
      return { data: null, error: { status: response.status, message } }
    }
    const data = await response.json() as { result: 'deleted' }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: { status: 0, message: (err as Error).message } }
  }
}

export async function api_dict_import_request_update({ dictionary_id, thread_id, ...body }: { dictionary_id: string, thread_id: string } & V1ImportRequestPatchRequestBody) {
  try {
    const response = await fetch(`/api/v1/dictionaries/${dictionary_id}/files/requests/${thread_id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })
    if (response.status !== ResponseCodes.OK) {
      const message = await response.text()
      return { data: null, error: { status: response.status, message } }
    }
    const data = await response.json() as V1ImportRequestPatchResponseBody
    return { data, error: null }
  } catch (err) {
    return { data: null, error: { status: 0, message: (err as Error).message } }
  }
}

export async function api_dict_files_request_import({ dictionary_id, ...body }: { dictionary_id: string } & V1FilesRequestImportRequestBody) {
  return await post_request<V1FilesRequestImportRequestBody, V1FilesRequestImportResponseBody>(`/api/v1/dictionaries/${dictionary_id}/files/request-import`, body)
}
