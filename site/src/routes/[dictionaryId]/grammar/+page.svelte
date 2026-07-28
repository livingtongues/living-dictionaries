<script lang="ts">
  import { page } from '$app/state'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import GrammarSectionsView from './GrammarSectionsView.svelte'
  import GrammarToc from './GrammarToc.svelte'
  import GrammarTocBar from './GrammarTocBar.svelte'
  import GlossingLegend from '$lib/corpus/GlossingLegend.svelte'
  import { grammar_sections_editable } from '$lib/corpus/grammar-preview'
  import { build_section_tree, has_title } from './grammar-tree'
  import { active_breadcrumb, build_toc_entries, GLOSSING_LEGEND_ANCHOR } from './grammar-toc'
  import { GrammarScrollSpy } from './scroll-spy.svelte'
  import { build_entry_link_index } from '$lib/entry-links/exact-lexeme-index'
  import { set_entry_mention_context } from '$lib/entry-links/mention-context'
  import type { EntryMentionClick } from '$lib/entry-links/link-entry-mentions'
  import EntryMentionPopover from '$lib/entry-links/EntryMentionPopover.svelte'
  import IconFa6SolidPencil from '~icons/fa6-solid/pencil'
  import IconMdiCheck from '~icons/mdi/check'

  const { data } = $props()
  const { is_manager, dictionary } = $derived(data)
  const { t, dict_db, entries_data } = $derived(page.data)

  // Since the 2026-07-15 cutover the section tree renders for everyone; since
  // 2026-07-27 STRUCTURAL editing is open to the dictionary's own managers (site
  // admins still bypass). The legacy `dictionaries.grammar` blob has been
  // migrated into sections + the column dropped (cutover stage 2).
  const can_edit = $derived(grammar_sections_editable({ auth_user: page.data.auth_user, is_manager }))

  // The page opens the way a VISITOR sees it — editors opt into the workbench.
  let edit_mode = $state(false)
  const editing = $derived(edit_mode && can_edit)

  // Mirror the text reader's live-read pattern: read `.rows` in a $derived that
  // depends only on the stable `dict_db` (not a churning live object).
  const rows = $derived([...(dict_db?.grammar_sections.rows ?? [])])
  const loading = $derived(dict_db?.grammar_sections.loading ?? true)
  const tree = $derived(build_section_tree(rows))

  const has_clause_slots = $derived((dict_db?.clause_slots.rows.length ?? 0) > 0)
  const has_legend = $derived((dict_db?.glossing_abbreviations.rows.length ?? 0) > 0)

  const spy = new GrammarScrollSpy()

  const toc_entries = $derived(build_toc_entries({
    tree,
    active_id: spy.active_id,
    prefer_languages: dictionary.gloss_languages ?? [],
    clause_template_label: has_clause_slots ? t('grammar.clause_template') : '',
    glossing_legend_label: has_legend ? t('grammar.glossing_legend') : '',
  }))

  // A table of contents earns its space once there are chapters to choose
  // between — a one-row TOC is just chrome.
  const show_toc = $derived(tree.filter(node => has_title(node.section)).length > 1)

  const breadcrumb = $derived(active_breadcrumb({
    tree,
    active_id: spy.active_id,
    prefer_languages: dictionary.gloss_languages ?? [],
  }))

  // Any entry mentioned in the prose becomes tappable (audio + gloss + jump).
  // Editing swaps the prose for a textarea, so the index is only built for
  // readers — that also keeps a 5k-entry rebuild off the editing path.
  const entry_link_index = $derived(edit_mode
    ? null
    : build_entry_link_index(Object.entries($entries_data).map(([id, entry]) => ({ id, lexeme: entry.main.lexeme }))))

  let open_mention = $state<EntryMentionClick | null>(null)

  set_entry_mention_context({
    get index() { return entry_link_index },
    open: (detail) => { open_mention = detail },
  })
</script>

<div class="grammar">
  <div class="header-row">
    <h3 class="grammar-heading">
      {t('dictionary.grammar')}
    </h3>
    {#if can_edit}
      <button
        type="button"
        class={edit_mode ? 'btn-primary btn-default' : 'btn btn-default'}
        style="gap: 0.375rem"
        onclick={() => edit_mode = !edit_mode}>
        {#if edit_mode}
          <IconMdiCheck /> {t('misc.done')}
        {:else}
          <IconFa6SolidPencil /> {t('misc.edit')}
        {/if}
      </button>
    {/if}
  </div>

  {#if show_toc}
    <GrammarTocBar entries={toc_entries} {breadcrumb} />
  {/if}

  <div class="layout" {@attach spy.watch}>
    <div class="main">
      <GrammarSectionsView {tree} {loading} editable={editing} prose_editable={editing && is_manager} {has_clause_slots} />
      {#if has_legend}
        <div id={GLOSSING_LEGEND_ANCHOR} data-grammar-anchor={GLOSSING_LEGEND_ANCHOR} class="legend-anchor">
          <GlossingLegend />
        </div>
      {/if}
    </div>

    {#if show_toc}
      <aside class="rail">
        <div class="rail-heading">{t('grammar.contents')}</div>
        <GrammarToc entries={toc_entries} follow_active />
      </aside>
    {/if}
  </div>
</div>

{#if open_mention}
  <EntryMentionPopover
    entry_ids={open_mention.entry_ids}
    form={open_mention.form}
    anchor={open_mention.anchor}
    on_close={() => open_mention = null} />
{/if}

<SeoMetaTags
  norobots={!dictionary.public}
  title={t('dictionary.grammar')}
  dictionaryName={dictionary.name}
  description="Learn about the grammar of the language in this Living Dictionary."
  keywords="Grammar of a language, grammatical, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Bibliography" />

<style>
  :global(.grammar img) {
    max-width: 100%;
  }

  :global(.grammar figure) {
    margin: 0;
  }

  .header-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .grammar-heading {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
    margin-right: 0.25rem;
  }

  .layout {
    display: flex;
    align-items: flex-start;
    gap: 1.5rem;
  }

  .main {
    flex: 1;
    min-width: 0;
  }

  .legend-anchor {
    scroll-margin-top: 7rem;
  }

  .rail {
    display: none;
    position: sticky;
    top: 3rem;
    flex-shrink: 0;
    width: 15rem;
    max-height: calc(100vh - 3.5rem);
    overflow-y: auto;
    padding-bottom: 1rem;
  }

  .rail-heading {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-secondary);
    padding: 0.25rem 0.5rem 0.5rem;
  }

  @media (min-width: 1024px) {
    .rail {
      display: block;
    }

    .legend-anchor {
      scroll-margin-top: 4rem;
    }
  }

  @media print {
    .rail {
      display: none;
    }
  }
</style>
