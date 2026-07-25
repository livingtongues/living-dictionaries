<script lang="ts">
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import SourceFiles from '$lib/components/sources/SourceFiles.svelte'
  import { page } from '$app/state'
  import type { Tables } from '$lib/types'
  import type { ImportFileForClient } from '$lib/import/types'
  import { completed_source_files_by_source } from '$lib/import/file-lifecycle'
  import EditSource from '$lib/components/sources/EditSource.svelte'
  import { api_dict_files_list } from '$api/v1/dictionaries/[id]/files/_call'
  import { toast } from '$lib/state/toast.svelte'
  import IconFaSolidPlus from '~icons/fa-solid/plus'
  import IconFaSolidPen from '~icons/fa-solid/pen'
  import IconFaSolidTrash from '~icons/fa-solid/trash'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'

  const { sources, can_edit, is_manager, dictionary, writes, t } = $derived(page.data)
  const connection = $derived(page.data.connection as { query: <T>(sql: string, params?: unknown[]) => Promise<T[]> } | null)

  let editing = $state<Tables<'sources'> | null | undefined>(undefined) // undefined = closed, null = create
  let usage = $state<Record<string, number>>({})
  let source_files = $state<ImportFileForClient[]>([])
  let source_files_loaded = $state(false)
  const source_files_by_source = $derived(completed_source_files_by_source(source_files))

  async function refresh_source_files(): Promise<boolean> {
    const { data, error } = await api_dict_files_list({ dictionary_id: dictionary.id })
    if (error) {
      if (error.status !== 401 && error.status !== 403)
        toast.error(error.message)
      return false
    }
    source_files = data.files
    source_files_loaded = true
    return true
  }

  $effect(() => {
    if (is_manager)
      refresh_source_files()
  })

  // Total reference count per slug across entries + senses + sentences + texts
  // (slug arrays) + audio + videos (scalar slug columns) + entry/sentence/text
  // citations ({slug, locator} arrays) — local wa-sqlite.
  $effect(() => {
    const _ = $sources // re-run when the registry changes
    if (!connection) return
    connection.query<{ slug: string, c: number }>(`
      SELECT value AS slug, COUNT(*) AS c FROM (
        SELECT value FROM entries CROSS JOIN json_each(entries.sources) WHERE entries.sources IS NOT NULL
        UNION ALL
        SELECT value FROM senses CROSS JOIN json_each(senses.sources) WHERE senses.sources IS NOT NULL
        UNION ALL
        SELECT value FROM sentences CROSS JOIN json_each(sentences.sources) WHERE sentences.sources IS NOT NULL
        UNION ALL
        SELECT value FROM texts CROSS JOIN json_each(texts.sources) WHERE texts.sources IS NOT NULL
        UNION ALL
        SELECT source AS value FROM audio WHERE source IS NOT NULL
        UNION ALL
        SELECT source AS value FROM videos WHERE source IS NOT NULL
        UNION ALL
        SELECT json_extract(value, '$.slug') AS value FROM entries CROSS JOIN json_each(entries.citations) WHERE entries.citations IS NOT NULL
        UNION ALL
        SELECT json_extract(value, '$.slug') AS value FROM sentences CROSS JOIN json_each(sentences.citations) WHERE sentences.citations IS NOT NULL
        UNION ALL
        SELECT json_extract(value, '$.slug') AS value FROM texts CROSS JOIN json_each(texts.citations) WHERE texts.citations IS NOT NULL
      ) GROUP BY value`)
      .then((rows) => { usage = Object.fromEntries(rows.map(row => [row.slug, row.c])) })
      .catch(err => console.error('source usage query failed', err))
  })

  async function delete_source(source: Tables<'sources'>) {
    if (is_manager && !source_files_loaded && !(await refresh_source_files()))
      return
    if (source_files_by_source[source.id]?.length) {
      toast.error(t({
        dynamicKey: 'source.files_prevent_delete',
        fallback: 'This source has permanent files attached and cannot be deleted. Edit its citation instead, or contact us to move the files.',
      }))
      return
    }
    const count = usage[source.slug] || 0
    const label = source.abbreviation || source.citation || source.slug
    if (count > 0) {
      if (!confirm(t({ dynamicKey: 'source.confirm_remove_all', fallback: `"${label}" is used by ${count} item(s). Remove it from all of them and delete the source?` })))
        return
      await writes.remove_source_and_delete({ source_id: source.id, slug: source.slug })
    } else {
      if (!confirm(`${t('misc.delete')} "${label}"?`))
        return
      await writes.remove_source_and_delete({ source_id: source.id, slug: source.slug })
    }
  }
</script>

<div class="header">
  <h3 class="sources-heading">{t({ dynamicKey: 'source.sources', fallback: 'Sources' })}</h3>
  {#if can_edit}
    <HeadlessButton class="btn-primary btn-default" onclick={() => (editing = null)}>
      <IconFaSolidPlus />
      {t({ dynamicKey: 'source.create', fallback: 'Add source' })}
    </HeadlessButton>
  {/if}
</div>

{#if !$sources?.length}
  <p class="empty">{t({ dynamicKey: 'source.empty', fallback: 'No sources yet. Add the printed dictionaries and wordlists this dictionary cites.' })}</p>
{:else}
  <table>
    <thead>
      <tr>
        <th>{t({ dynamicKey: 'source.abbreviation', fallback: 'Abbreviation' })}</th>
        <th>{t({ dynamicKey: 'source.citation', fallback: 'Citation' })}</th>
        <th>{t({ dynamicKey: 'source.type', fallback: 'Type' })}</th>
        <th class="num">{t({ dynamicKey: 'source.used_by', fallback: 'Used by' })}</th>
        {#if can_edit}<th></th>{/if}
      </tr>
    </thead>
    <tbody>
      {#each $sources as source (source.id)}
        <tr>
          <td>{source.abbreviation || source.slug}</td>
          <td class="citation">{source.citation || ''}</td>
          <td>{source.type ? t({ dynamicKey: `source.type_${source.type}`, fallback: source.type }) : ''}</td>
          <td class="num">{usage[source.slug] || 0}</td>
          {#if can_edit}
            <td class="actions">
              <button type="button" title={t('misc.edit')} onclick={() => (editing = source)}><IconFaSolidPen /></button>
              <button type="button" class="danger" title={t('misc.delete')} onclick={() => delete_source(source)}><IconFaSolidTrash /></button>
            </td>
          {/if}
        </tr>
        {#if is_manager && source_files_by_source[source.id]?.length}
          <tr class="source-files-row">
            <td colspan={can_edit ? 5 : 4}>
              <SourceFiles
                dictionary_id={dictionary.id}
                files={source_files_by_source[source.id]}
                label={t({ dynamicKey: 'source.files', fallback: 'Source files' })} />
            </td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
{/if}

{#if editing !== undefined}
  <EditSource source={editing} on_close={() => (editing = undefined)} />
{/if}

<SeoMetaTags
  norobots
  title={t({ dynamicKey: 'source.sources', fallback: 'Sources' })}
  dictionaryName={dictionary.name}
  description="Where the words in this Living Dictionary came from." />

<style>
  .sources-heading {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .empty {
    opacity: 0.6;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  th, td {
    text-align: left;
    padding: 0.5rem;
    border-bottom: 1px solid rgba(127, 127, 127, 0.2);
    vertical-align: top;
  }
  th {
    font-size: 0.75rem;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .citation {
    max-width: 28rem;
  }
  .source-files-row td {
    padding: 0.35rem 0.5rem 0.75rem;
  }
  .num {
    text-align: right;
    white-space: nowrap;
  }
  .actions {
    white-space: nowrap;
    text-align: right;
  }
  .actions button {
    padding: 0.25rem 0.375rem;
    opacity: 0.6;
  }
  .actions button:hover {
    opacity: 1;
  }
  .actions .danger:hover {
    color: #dc2626;
  }
</style>
