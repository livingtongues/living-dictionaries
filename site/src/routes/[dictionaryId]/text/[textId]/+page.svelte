<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { tick } from 'svelte'
  import Button from '$lib/components/ui/Button.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import EditFieldModal from '$lib/components/entry/EditFieldModal.svelte'
  import SentenceEditPanel from './SentenceEditPanel.svelte'
  import AppendSentencesModal from './AppendSentencesModal.svelte'
  import { get_headword } from '$lib/helpers/orthographies'
  import type { DictRowType } from '$lib/db/dict-client/dict-live-db.svelte'
  import IconSvgSpinners3DotsFade from '~icons/svg-spinners/3-dots-fade'
  import IconSystemUiconsTrash from '~icons/system-uicons/trash'
  import IconFaSolidPlus from '~icons/fa-solid/plus'
  import IconFa6SolidPencil from '~icons/fa6-solid/pencil'
  import IconCarbonTranslate from '~icons/carbon/translate'

  const { data } = $props()
  const { dictionary, can_edit } = $derived(data)
  const dict_db = $derived(page.data.dict_db)

  const text_id = $derived(page.params.textId)
  const text = $derived(dict_db?.texts.id(text_id))
  const loading = $derived(dict_db?.texts.loading ?? true)

  const ordered = $derived([...(dict_db?.sentences.rows ?? [])]
    .filter(sentence => sentence.text_id === text_id)
    .sort((first, second) =>
      (first.sort_key || '').localeCompare(second.sort_key || '')
        || (first.created_at || '').localeCompare(second.created_at || '')))

  const paragraphs = $derived.by(() => {
    const groups: DictRowType<'sentences'>[][] = []
    let current: DictRowType<'sentences'>[] = []
    for (const sentence of ordered) {
      current.push(sentence)
      if (sentence.ends_paragraph) {
        groups.push(current)
        current = []
      }
    }
    if (current.length)
      groups.push(current)
    return groups
  })

  const title_headword = $derived(get_headword({ lexeme: text?.title, orthographies: dictionary.orthographies }))
  const display_title = $derived(title_headword.value || page.data.t('text.untitled'))

  let show_translations = $state(true)
  let selected_id = $state<string | null>(null)
  const selected_sentence = $derived(selected_id ? dict_db?.sentences.id(selected_id) : null)
  let show_append = $state(false)
  let show_title_edit = $state(false)

  function sentence_display(sentence: DictRowType<'sentences'>): string {
    return get_headword({ lexeme: sentence.text, orthographies: dictionary.orthographies }).value
  }

  // Deep-link support: search results link in-text sentences as /text/{id}#{sentence_id}.
  // page.url.hash reacts to client-side navigations; the location fallback covers
  // hard loads (the server never sees the fragment, so page.url.hash starts empty).
  let anchored_id = $state<string | null>(null)
  let last_anchor_applied = ''
  $effect(() => {
    const hash = (page.url.hash || location.hash).slice(1)
    if (!hash || hash === last_anchor_applied || !ordered.length) return
    if (!ordered.some(sentence => sentence.id === hash)) return
    last_anchor_applied = hash
    anchored_id = hash
    tick().then(() => document.getElementById(`s-${hash}`)?.scrollIntoView({ block: 'center' }))
  })

  function select_sentence(sentence_id: string) {
    anchored_id = null
    selected_id = sentence_id
  }

  async function save_title(new_value: string) {
    if (!text || !new_value) return
    text.title = { ...(text.title || {}), [title_headword.code]: new_value }
    await text._save()
  }

  async function delete_text() {
    if (!confirm(page.data.t('text.delete_confirm'))) return
    // Delete the sentences FIRST: the texts FK is ON DELETE SET NULL, so deleting
    // the text first would silently flip them to standalone sentences.
    const sentence_ids = ordered.map(sentence => sentence.id)
    if (sentence_ids.length)
      await dict_db.sentences.delete(sentence_ids)
    await dict_db.texts.delete(text_id)
    await goto(`/${dictionary.url}/texts`)
  }
</script>

<div class="text-page">
  <nav class="breadcrumb">
    <a href={`/${dictionary.url}/texts`}>{page.data.t('dictionary.texts')}</a>
    <span class="crumb-sep">/</span>
    <span>{display_title}</span>
  </nav>

  {#if text}
    <div class="title-row">
      <h2>{display_title}</h2>
      {#if can_edit}
        <button type="button" class="icon-action" title={page.data.t('text.edit_title')} onclick={() => show_title_edit = true}>
          <IconFa6SolidPencil class="icon-inline" />
        </button>
      {/if}
    </div>

    <div class="toolbar">
      <span class="meta">{page.data.t('text.sentence_count', { values: { count: String(ordered.length) } })}</span>
      <span style="flex-grow: 1"></span>
      <button
        type="button"
        class="btn-outline btn-sm"
        class:toolbar-active={show_translations}
        style="gap: 0.375rem"
        onclick={() => show_translations = !show_translations}>
        <IconCarbonTranslate class="icon-inline" />
        {page.data.t('text.show_translations')}
      </button>
      {#if can_edit}
        <Button form="filled" onclick={() => show_append = true}>
          <IconFaSolidPlus class="icon-inline" style="margin-top: -0.25rem" />
          {page.data.t('text.append')}
        </Button>
      {/if}
    </div>

    <article class="reader" class:interlinear={show_translations}>
      {#each paragraphs as paragraph, paragraph_index (paragraph_index)}
        <p class="paragraph">
          {#each paragraph as sentence (sentence.id)}
            {#if show_translations}
              <span class="sentence-block" id={`s-${sentence.id}`}>
                <button
                  type="button"
                  class="sentence"
                  class:selected={selected_id === sentence.id}
                  class:anchored={anchored_id === sentence.id}
                  onclick={() => select_sentence(sentence.id)}>
                  {sentence_display(sentence)}
                </button>
                {#each Object.values(sentence.translation || {}).filter(Boolean) as translation, translation_index (translation_index)}
                  <span class="translation">{translation}</span>
                {/each}
              </span>
            {:else}
              <button
                type="button"
                class="sentence"
                id={`s-${sentence.id}`}
                class:selected={selected_id === sentence.id}
                class:anchored={anchored_id === sentence.id}
                onclick={() => select_sentence(sentence.id)}>
                {sentence_display(sentence)}
              </button>
            {/if}
          {/each}
        </p>
      {/each}
      {#if !ordered.length}
        <div class="state-note">{page.data.t('sentence.none_yet')}</div>
      {/if}
    </article>

    {#if can_edit}
      <div class="danger-zone">
        <button type="button" class="btn-outline btn-sm" style="gap: 0.375rem; color: var(--danger)" onclick={delete_text}>
          <IconSystemUiconsTrash class="icon-inline" />
          {page.data.t('text.delete')}
        </button>
      </div>
    {/if}
  {:else if loading}
    <div class="state-note"><IconSvgSpinners3DotsFade class="icon-inline" /></div>
  {:else}
    <div class="state-note">{page.data.t('text.none_yet')}</div>
  {/if}
</div>

{#if selected_sentence}
  <SentenceEditPanel
    sentence={selected_sentence}
    {can_edit}
    on_close={() => selected_id = null}
    on_deleted={() => selected_id = null} />
{/if}

{#if show_append}
  <AppendSentencesModal
    {text_id}
    last_sort_key={ordered.length ? ordered[ordered.length - 1].sort_key : null}
    on_close={() => show_append = false} />
{/if}

{#if show_title_edit}
  <EditFieldModal
    field="example_sentence"
    display={page.data.t('text.title')}
    value={title_headword.value}
    on_update={save_title}
    on_close={() => show_title_edit = false} />
{/if}

<style>
  .text-page {
    padding-top: 0.5rem;
    max-width: 46rem;
    padding-bottom: 3rem;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--color-secondary);
    margin-bottom: 0.75rem;
  }

  .breadcrumb a {
    color: var(--color-secondary);
  }

  .breadcrumb a:hover {
    text-decoration: underline;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 600;
  }

  .icon-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.375rem;
    color: var(--color-secondary);
  }

  .icon-action:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%);
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.75rem 0 1.25rem;
  }

  .meta {
    font-size: 0.8125rem;
    color: var(--color-secondary);
  }

  .toolbar-active {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%);
  }

  .reader {
    font-size: 1.125rem;
    line-height: 1.9;
  }

  .paragraph {
    margin-bottom: 1.25rem;
  }

  .sentence {
    display: inline;
    text-align: start;
    font: inherit;
    color: inherit;
    border-radius: 0.25rem;
    padding: 0.0625rem 0.125rem;
    margin: -0.0625rem -0.125rem;
  }

  .sentence:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 8%);
  }

  .sentence.selected {
    background-color: color-mix(in srgb, var(--primary) 18%, var(--background));
  }

  .sentence.anchored {
    background-color: color-mix(in srgb, var(--primary) 28%, var(--background));
  }

  /* Interlinear mode: one sentence per line with its translations beneath. */
  .interlinear .sentence-block {
    display: block;
    margin-bottom: 0.75rem;
  }

  .interlinear .sentence {
    display: inline-block;
  }

  .interlinear .translation {
    display: block;
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--color-secondary);
  }

  .danger-zone {
    margin-top: 3rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }

  .state-note {
    padding: 2rem 0;
    color: var(--color-secondary);
  }
</style>

<SeoMetaTags
  norobots={!dictionary.public}
  admin={data.auth_user.admin_level > 0}
  title={display_title}
  dictionaryName={dictionary.name}
  description="A text in this Living Dictionary." />
