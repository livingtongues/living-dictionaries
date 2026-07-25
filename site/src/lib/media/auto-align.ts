import type { TranslateFunction } from '$lib/i18n/types'
import { api_v1_align_audio, api_v1_align_job_status } from '$api/v1/dictionaries/[id]/align/_call'
import { ALIGN_POLL_DEADLINE_MS } from '$lib/constants'
import { toast } from '$lib/state/toast.svelte'

/**
 * Start a forced-alignment job and follow it to completion with toasts — the
 * shared flow behind the manual Auto-align button AND the `auto_align`
 * graduated-dictionary post-attach trigger. On success pulls fresh timings
 * into the local DB (`sync_now`) so karaoke lights up immediately.
 *
 * Polling stops at `ALIGN_POLL_DEADLINE_MS` — past the server's own stale-job
 * sweep bound, so by then the job is guaranteed terminal (or unreachable) and
 * the user gets a retryable message instead of an endless spinner.
 */
export async function run_auto_align({ dictionary_id, target_kind, target_id, audio_id, t, sync_now }: {
  dictionary_id: string
  target_kind: 'text' | 'sentence'
  target_id: string
  audio_id: string
  t: TranslateFunction
  sync_now: (() => Promise<void>) | undefined
}): Promise<void> {
  const { data, error } = await api_v1_align_audio({ dictionary_id, target_kind, target_id, audio_id })
  if (error) {
    toast.error(`${t('timings.align_failed')}: ${error.message}`)
    return
  }
  if (data.coverage.tokens_aligned < data.coverage.tokens_total)
    toast(t('timings.align_gaps', { values: { count: String(data.coverage.tokens_total - data.coverage.tokens_aligned) } }))

  const give_up_at = Date.now() + ALIGN_POLL_DEADLINE_MS
  for (;;) {
    await new Promise(resolve => setTimeout(resolve, 2000))
    if (Date.now() > give_up_at) {
      toast.error(t('timings.align_timed_out'))
      return
    }
    const status = await api_v1_align_job_status({ dictionary_id, job_id: data.job.id })
    if (status.error) {
      toast.error(`${t('timings.align_failed')}: ${status.error.message}`)
      return
    }
    if (status.data.job.status === 'running')
      continue
    if (status.data.job.status === 'failed') {
      toast.error(`${t('timings.align_failed')}: ${status.data.job.error ?? ''}`)
      return
    }
    await sync_now?.()
    toast.success(t('timings.align_done'))
    return
  }
}
