<script lang="ts">
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import { page } from '$app/state'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { render_markdown_to_html } from '$lib/markdown/render'
  import { sanitize_rich_text as sanitize } from '$lib/markdown/sanitize-rich-text'
  import GrammarSectionsView from './GrammarSectionsView.svelte'
  import { grammar_sections_editable, grammar_sections_visible } from '$lib/corpus/grammar-preview'

  const { data } = $props()
  const { is_manager, dictionary, update_grammar } = $derived(data)
  let updated = $state('')

  let editing = $state(false)

  // Structured section tree is admin-3 preview-only until the cutover deploy
  // (which runs the blob→sections backfill AND widens this to public together).
  const sections_visible = $derived(grammar_sections_visible({ auth_user: page.data.auth_user }))
  const sections_editable = $derived(grammar_sections_editable({ auth_user: page.data.auth_user }))

  function start_editing() {
    updated = dictionary.grammar || ''
    editing = true
  }
</script>

<div class="grammar">
  <h3 class="grammar-heading">
    {page.data.t('dictionary.grammar')}
  </h3>

  {#if is_manager}
    <div class="actions">
      {#if editing}
        <button type="button" class="btn btn-default" onclick={() => (editing = false)}>{page.data.t('misc.cancel')}</button>
        <HeadlessButton
          class="btn-primary btn-default"
          onclick={async () => {
            await update_grammar(updated)
            editing = false
          }}>{page.data.t('misc.save')}</HeadlessButton>
      {:else}
        <button type="button" class="btn btn-default" onclick={start_editing}>{page.data.t('misc.edit')}</button>
      {/if}
    </div>
  {/if}

  <div style="display: flex">
    {#if editing}
      <div style="flex: 1; max-width: 768px">
        {#await import('$lib/markdown/MarkdownEditor.svelte') then { default: MarkdownEditor }}
          <MarkdownEditor bind:value={updated} />
        {/await}
      </div>
    {/if}
    <div class="tw-prose grammar-content" class:editing>
      {#if updated}
        {@html sanitize(render_markdown_to_html(updated))}
      {:else if dictionary.grammar}
        {@html sanitize(render_markdown_to_html(dictionary.grammar))}
      {:else}
        <i>{page.data.t('dictionary.no_info_yet')}</i>
      {/if}
    </div>
  </div>

  {#if sections_visible}
    <div class="sections-block">
      <div class="preview-badge">{page.data.t('grammar.preview_badge')}</div>
      <GrammarSectionsView editable={sections_editable} />
    </div>
  {/if}
</div>

<SeoMetaTags
  norobots={!dictionary.public}
  title={page.data.t('dictionary.grammar')}
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

  .grammar-heading {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .grammar-content {
    max-width: 768px;
  }

  .grammar-content.editing {
    display: none;
    margin-top: 3.5rem;
    margin-left: 0.75rem;
  }

  @media (min-width: 768px) {
    .grammar-content.editing {
      display: block;
    }
  }

  .sections-block {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
    max-width: 768px;
  }

  .preview-badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 12%, var(--background));
    margin-bottom: 0.5rem;
  }
</style>
