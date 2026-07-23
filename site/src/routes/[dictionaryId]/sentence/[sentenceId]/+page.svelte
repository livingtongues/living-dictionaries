<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import EntryField from '../../entry/[entryId]/EntryField.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import TokenizedSentence from '$lib/corpus/TokenizedSentence.svelte'
  import TokenPopover from '$lib/corpus/TokenPopover.svelte'
  import { pick_tokenization_orthography } from '$lib/corpus/tokenize-sentence'
  import { get_orthographies } from '$lib/orthography/orthographies'
  import { order_entry_and_dictionary_gloss_languages } from '$lib/gloss/order-glosses'
  import IconSvgSpinners3DotsFade from '~icons/svg-spinners/3-dots-fade'
  import IconSystemUiconsTrash from '~icons/system-uicons/trash'
  import IconCarbonDocument from '~icons/carbon/document'
  import IconMdiRefresh from '~icons/mdi/refresh'

  const { data } = $props()
  const { dictionary, can_edit } = $derived(data)
  const dict_db = $derived(page.data.dict_db)

  const sentence_id = $derived(page.params.sentenceId)
  const sentence = $derived(dict_db?.sentences.id(sentence_id))
  const loading = $derived(dict_db?.sentences.loading ?? true)

  const orthographies = $derived(get_orthographies(dictionary ?? {}))
  const glossing_languages = $derived(order_entry_and_dictionary_gloss_languages(sentence?.translation, dictionary.gloss_languages))
  const parent_text = $derived(sentence?.text_id ? dict_db?.texts.id(sentence.text_id) : null)

  const sentences_scope_href = $derived(`/${dictionary.url}/entries?q=${encodeURIComponent('{"scope":"sentences"}')}`)
  const seo_title = $derived((Object.values(sentence?.text || {}).find(Boolean) as string) || page.data.t('sentence.sentence'))

  // Worker op (not the live-row _save): text changes re-tokenize + re-match in
  // the same transaction, preserving confirmed/gold-IGT tokens.
  async function save(patch: Record<string, unknown>) {
    if (!sentence) return
    await page.data.writes.update_sentence({ id: sentence_id, ...patch })
  }

  async function delete_sentence() {
    if (!sentence) return

    if (!confirm(`${page.data.t('sentence.delete')}?`)) return
    await sentence._delete()
    await goto(sentences_scope_href)
  }

  // --- Word→entry matching (M3) ---
  const token_orthography = $derived(sentence ? pick_tokenization_orthography(sentence.text) : null)
  const token_text = $derived(token_orthography ? sentence?.text?.[token_orthography] ?? '' : '')
  const has_tokens = $derived(!!(token_orthography && sentence?.tokens?.[token_orthography]?.length))
  let token_popover = $state<{ token_index: number, anchor: HTMLElement } | null>(null)
  let analyzing = $state(false)

  async function reanalyze() {
    if (analyzing) return
    analyzing = true
    try {
      await page.data.writes.analyze_sentence(sentence_id)
    } finally {
      analyzing = false
    }
  }
</script>

<div class="sentence-page">
  <nav class="breadcrumb">
    <a href={sentences_scope_href}>{page.data.t('sentence.sentences')}</a>
    {#if parent_text}
      <span class="crumb-sep">/</span>
      <span class="parent-text"><IconCarbonDocument />
        {page.data.t('sentence.part_of_text')}: {Object.values(parent_text.title || {}).find(Boolean) || ''}</span>
    {/if}
  </nav>

  {#if sentence}
    <div class="fields">
      {#each orthographies.all as orthography (orthography.code)}
        <EntryField
          value={sentence.text?.[orthography.code]}
          field="example_sentence"
          {can_edit}
          bcp={orthography.bcp}
          display={orthography.primary
            ? page.data.t('sentence.sentence')
            : `${orthography.name}: ${page.data.t('sentence.sentence')}`}
          on_update={new_value => save({ text: { ...(sentence.text || {}), [orthography.code]: new_value } })} />
      {/each}

      {#each glossing_languages as bcp (bcp)}
        <EntryField
          value={sentence.translation?.[bcp]}
          field="example_sentence"
          {bcp}
          {can_edit}
          display="{page.data.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })}: {page.data.t('sentence.translation')}"
          on_update={new_value => save({ translation: { ...(sentence.translation || {}), [bcp]: new_value } })} />
      {/each}
    </div>

    {#if has_tokens && token_orthography}
      <div class="token-strip" class:can-edit={can_edit}>
        <TokenizedSentence
          tokens={sentence.tokens}
          orthography={token_orthography}
          text={token_text}
          {can_edit}
          review_mode={can_edit}
          selected_index={token_popover?.token_index ?? null}
          on_token_tap={args => token_popover = args} />
      </div>
    {/if}
    {#if can_edit}
      <div class="actions">
        <button type="button" class="btn-outline btn-sm" style="gap: 0.375rem" disabled={analyzing} onclick={reanalyze}>
          {#if analyzing}
            <IconSvgSpinners3DotsFade />
          {:else}
            <IconMdiRefresh />
          {/if}
          {page.data.t('token.reanalyze')}
        </button>
        <button type="button" class="btn-outline btn-sm" style="gap: 0.375rem; color: var(--danger)" onclick={delete_sentence}>
          <IconSystemUiconsTrash />
          {page.data.t('sentence.delete')}
        </button>
      </div>
    {/if}
  {:else if loading}
    <div class="state-note"><IconSvgSpinners3DotsFade /></div>
  {:else}
    <div class="state-note">{page.data.t('sentence.no_results')}</div>
  {/if}
</div>

<style>
  .sentence-page {
    padding-top: 0.5rem;
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
    text-decoration: none;
  }

  .breadcrumb a:hover {
    text-decoration: underline;
  }

  .parent-text {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .fields {
    display: flex;
    flex-direction: column;
    max-width: 42rem;
  }

  .fields :global(.field-value.underlined) {
    font-size: 1.125rem;
  }

  .token-strip {
    margin-top: 1rem;
    font-size: 1.125rem;
    line-height: 1.9;
    max-width: 42rem;
  }

  .actions {
    margin-top: 1.5rem;
    display: flex;
    gap: 0.5rem;
  }

  .state-note {
    padding: 2rem 0;
    color: var(--color-secondary);
  }
</style>

<SeoMetaTags
  norobots={!dictionary.public}
  admin={data.auth_user.admin_level > 0}
  title={seo_title}
  dictionaryName={dictionary.name}
  description="A sentence in this Living Dictionary." />

{#if token_popover && sentence && token_orthography}
  <TokenPopover
    {sentence}
    orthography={token_orthography}
    token_index={token_popover.token_index}
    anchor={token_popover.anchor}
    {can_edit}
    on_close={() => token_popover = null} />
{/if}
