import type { RequestHandler } from '@sveltejs/kit'
import type { AlignJobRow, RequestAlignJobResult } from '$lib/db/server/align/align-job'
import { ResponseCodes } from '$lib/constants'
import { AlignRequestError, get_align_job, request_align_job } from '$lib/db/server/align/align-job'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

/**
 * `/api/v1` forced-alignment routes (M6). POST starts a fire-and-forget job
 * (write access = manager for humans); GET polls its status (read access).
 * Same endpoints serve the in-app Auto-align button (session cookie) and
 * agents (API key) — human/agent parity through one server module.
 */

export interface AlignJobStatusBody {
  job: Pick<AlignJobRow, 'id' | 'status' | 'error' | 'tokens_total' | 'tokens_aligned' | 'created_at' | 'finished_at'>
}

export interface AlignStartResponseBody extends AlignJobStatusBody {
  coverage: RequestAlignJobResult['coverage']
}

function job_body(job: AlignJobRow): AlignJobStatusBody['job'] {
  const { id, status, error: job_error, tokens_total, tokens_aligned, created_at, finished_at } = job
  return { id, status, error: job_error, tokens_total, tokens_aligned, created_at, finished_at }
}

export function make_align_start_handler(target_kind: 'text' | 'sentence'): RequestHandler {
  return async (event) => {
    const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })
    const target_id = target_kind === 'text' ? event.params.textId : event.params.sentenceId
    const audio_id = event.params.audioId
    if (!target_id || !audio_id)
      error(ResponseCodes.BAD_REQUEST, 'missing route params')

    try {
      const { job, coverage } = request_align_job({
        dictionary_id: dictionary.id,
        target_kind,
        target_id,
        audio_id,
        align_config: dictionary.align_config,
        user_id: access.user_id,
        via: access.via === 'api_key' ? 'v1' : 'ui',
      })
      log_server_event({ level: 'info', message: 'align_job_started', user_id: access.user_id, context: { dictionary_id: dictionary.id, job_id: job.id, target_kind, target_id, audio_id, via: access.via, ...coverage, gap_forms: coverage.gap_forms.slice(0, 50) } })
      return json({ job: job_body(job), coverage } satisfies AlignStartResponseBody)
    } catch (err) {
      if (err instanceof AlignRequestError)
        error(err.status, err.message)
      throw err
    }
  }
}

export const align_job_status_handler: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })
  const job = get_align_job({ job_id: event.params.jobId ?? '', dictionary_id: dictionary.id })
  if (!job)
    error(ResponseCodes.NOT_FOUND, 'alignment job not found')
  return json({ job: job_body(job) } satisfies AlignJobStatusBody)
}
