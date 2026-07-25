<script lang="ts">
  import type { ThreadArtifactRow } from '$lib/db/server/import-conversations'
  import IconMdiDownload from '~icons/mdi/download'
  import IconMdiOpenInNew from '~icons/mdi/open-in-new'
  import { page } from '$app/state'
  import { conversation_artifact_url } from '$api/v1/dictionaries/[id]/conversations/_call'
  import SandboxedFrame from '$lib/components/ui/SandboxedFrame.svelte'
  import { format_date_time } from '$lib/utils/format-relative-time'

  interface Props {
    artifact: ThreadArtifactRow
    dictionary_id: string
    thread_id: string
  }
  const { artifact, dictionary_id, thread_id }: Props = $props()
  const { t } = $derived(page.data)

  const src = $derived(conversation_artifact_url({ dictionary_id, thread_id, artifact_id: artifact.id }))
  const download_href = $derived(conversation_artifact_url({ dictionary_id, thread_id, artifact_id: artifact.id, download: true }))

  /** `{ entries: 1827, senses: 2018 }` → "1,827 entries · 2,018 senses". */
  const summary = $derived.by(() => {
    if (!artifact.stats_json)
      return ''
    try {
      const stats = JSON.parse(artifact.stats_json) as Record<string, unknown>
      return Object.entries(stats)
        .filter(([, value]) => typeof value === 'number' || typeof value === 'string')
        .map(([key, value]) => `${typeof value === 'number' ? new Intl.NumberFormat().format(value) : value} ${key.replace(/_/g, ' ')}`)
        .join(' · ')
    } catch {
      return ''
    }
  })

  // Joined here rather than in the markup: Svelte trims whitespace at a block
  // edge, so a literal ` · ` inside an `{#if}` loses its trailing space.
  const meta = $derived([summary, format_date_time(artifact.created_at)].filter(Boolean).join(' · '))
</script>

<section class="artifact">
  <header>
    <div class="titles">
      <h4>{artifact.title || t('import_page.report_heading')}</h4>
      <p class="summary">{meta}</p>
    </div>
    <div class="actions">
      <a class="btn btn-sm" href={src} target="_blank" rel="noopener">
        <IconMdiOpenInNew />
        {t('import_page.open_full_report')}
      </a>
      <a class="btn btn-sm" href={download_href}>
        <IconMdiDownload />
        {t('import_page.download_report')}
      </a>
    </div>
  </header>
  <SandboxedFrame {src} title={artifact.title || t('import_page.report_heading')} />
</section>

<style>
  .artifact {
    border: 1px solid color-mix(in srgb, var(--color) 14%, var(--background));
    border-radius: 0.875rem;
    overflow: hidden;
    background: var(--surface);
  }
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.7rem 0.9rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color) 12%, var(--background));
  }
  h4 {
    font-weight: 700;
    font-size: 0.95rem;
  }
  .summary {
    font-size: 0.75rem;
    color: var(--color-secondary);
    margin-top: 0.1rem;
  }
  .actions {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .actions .btn {
    gap: 0.3rem;
  }
</style>
