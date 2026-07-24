import type { AlignJobStatusBody, AlignStartResponseBody } from '$lib/api/v1/align-route-handlers'
import { get_request, post_request } from '$lib/utils/requests'

/** Start a forced-alignment job for text- or sentence-level audio (manager+). */
export async function api_v1_align_audio({ dictionary_id, target_kind, target_id, audio_id }: {
  dictionary_id: string
  target_kind: 'text' | 'sentence'
  target_id: string
  audio_id: string
}) {
  const owner_segment = target_kind === 'text' ? 'texts' : 'sentences'
  return await post_request<Record<string, never>, AlignStartResponseBody>(`/api/v1/dictionaries/${dictionary_id}/${owner_segment}/${target_id}/audio/${audio_id}/align`, {})
}

/** Poll a running alignment job. */
export async function api_v1_align_job_status({ dictionary_id, job_id }: { dictionary_id: string, job_id: string }) {
  return await get_request<AlignJobStatusBody>(`/api/v1/dictionaries/${dictionary_id}/align-jobs/${job_id}`)
}
