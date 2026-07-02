<script lang="ts">
  import { Button } from '$lib/svelte-pieces'
  import { page } from '$app/state'
  import type { Tables } from '$lib/types'
  import EditSource from '$lib/components/sources/EditSource.svelte'
  import IconFaSolidPlus from '~icons/fa-solid/plus'
  import IconFaSolidPen from '~icons/fa-solid/pen'
  import IconFaSolidTrash from '~icons/fa-solid/trash'

  const { sources, can_edit, dbOperations, t } = $derived(page.data)
  const connection = $derived(page.data.connection as { query: <T>(sql: string, params?: unknown[]) => Promise<T[]> } | null)

  let editing = $state<Tables<'sources'> | null | undefined>(undefined) // undefined = closed, null = create
  let usage = $state<Record<string, number>>({})

  // Total reference count per slug across entries + sentences + texts (slug
  // arrays) + audio + videos (scalar slug columns) — local wa-sqlite.
  $effect(() => {
    const _ = $sources // re-run when the registry changes
    if (!connection) return
    connection.query<{ slug: string, c: number }>(`
      SELECT value AS slug, COUNT(*) AS c FROM (
        SELECT value FROM entries CROSS JOIN json_each(entries.sources) WHERE entries.sources IS NOT NULL
        UNION ALL
        SELECT value FROM sentences CROSS JOIN json_each(sentences.sources) WHERE sentences.sources IS NOT NULL
        UNION ALL
        SELECT value FROM texts CROSS JOIN json_each(texts.sources) WHERE texts.sources IS NOT NULL
        UNION ALL
        SELECT source AS value FROM audio WHERE source IS NOT NULL
        UNION ALL
        SELECT source AS value FROM videos WHERE source IS NOT NULL
      ) GROUP BY value`)
      .then((rows) => { usage = Object.fromEntries(rows.map(row => [row.slug, row.c])) })
      .catch(err => console.error('source usage query failed', err))
  })

  async function delete_source(source: Tables<'sources'>) {
    const count = usage[source.slug] || 0
    const label = source.abbreviation || source.citation || source.slug
    if (count > 0) {
      if (!confirm(t({ dynamicKey: 'source.confirm_remove_all', fallback: `"${label}" is used by ${count} item(s). Remove it from all of them and delete the source?` })))
        return
      await dbOperations.remove_source_and_delete({ source_id: source.id, slug: source.slug })
    } else {
      if (!confirm(`${t('misc.delete')} "${label}"?`))
        return
      await dbOperations.remove_source_and_delete({ source_id: source.id, slug: source.slug })
    }
  }
</script>

<svelte:head><title>{t({ dynamicKey: 'source.sources', fallback: 'Sources' })}</title></svelte:head>

<div class="header">
  <h3 class="sources-heading">{t({ dynamicKey: 'source.sources', fallback: 'Sources' })}</h3>
  {#if can_edit}
    <Button form="filled" onclick={() => (editing = null)}>
      <IconFaSolidPlus class="icon-inline" />
      {t({ dynamicKey: 'source.create', fallback: 'Add source' })}
    </Button>
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
              <button type="button" title={t('misc.edit')} onclick={() => (editing = source)}><IconFaSolidPen class="icon-inline" /></button>
              <button type="button" class="danger" title={t('misc.delete')} onclick={() => delete_source(source)}><IconFaSolidTrash class="icon-inline" /></button>
            </td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

{#if editing !== undefined}
  <EditSource source={editing} on_close={() => (editing = undefined)} />
{/if}

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
