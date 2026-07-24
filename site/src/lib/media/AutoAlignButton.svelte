<script lang="ts">
  import { page } from '$app/state'
  import IconMdiAutoFix from '~icons/mdi/auto-fix'
  import { run_auto_align } from '$lib/media/auto-align'

  interface Props {
    target_kind: 'text' | 'sentence'
    target_id: string
    audio_id: string
    has_timings: boolean
  }

  const { target_kind, target_id, audio_id, has_timings }: Props = $props()

  let aligning = $state(false)

  async function auto_align() {
    if (has_timings && !confirm(page.data.t('timings.align_replaces_existing')))
      return
    aligning = true
    try {
      await run_auto_align({
        dictionary_id: page.data.dictionary.id,
        target_kind,
        target_id,
        audio_id,
        t: page.data.t,
        sync_now: page.data.connection ? () => page.data.connection.sync_now() : undefined,
      })
    } finally {
      aligning = false
    }
  }
</script>

<button type="button" class="btn-outline btn-sm" style="gap: 0.375rem" disabled={aligning} onclick={auto_align}>
  <IconMdiAutoFix />
  <span class="wide-only">{aligning ? page.data.t('timings.aligning') : page.data.t('timings.auto_align')}</span>
</button>

<style>
  .wide-only {
    display: none;
  }

  @media (min-width: 640px) {
    .wide-only {
      display: inline;
    }
  }
</style>
