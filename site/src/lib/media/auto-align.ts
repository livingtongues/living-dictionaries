import type { TranslateFunction } from '$lib/i18n/types'
import { api_v1_align_audio, api_v1_align_job_status } from '$api/v1/dictionaries/[id]/align/_call'
import { toast } from '$lib/state/toast.svelte'

/**
 * Start a forced-alignment job and follow it to completion with toasts — the
 * shared flow behind the manual Auto-align button AND the `auto_align`
 * graduated-dictionary post-attach trigger. On success pulls fresh timings
 * into the local DB (`sync_now`) so karaoke lights up immediately.
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

  for (;;) {
    await new Promise(resolve => setTimeout(resolve, 2000))
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
