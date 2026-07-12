<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import EntryField from '../../entry/[entryId]/EntryField.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { get_orthographies } from '$lib/helpers/orthographies'
  import { order_entry_and_dictionary_gloss_languages } from '$lib/helpers/glosses'
  import IconSvgSpinners3DotsFade from '~icons/svg-spinners/3-dots-fade'
  import IconSystemUiconsTrash from '~icons/system-uicons/trash'
  import IconCarbonDocument from '~icons/carbon/document'

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

  async function save(patch: Record<string, unknown>) {
    if (!sentence) return
    Object.assign(sentence, patch)
    await sentence._save()
  }

  async function delete_sentence() {
    if (!sentence) return
    // eslint-disable-next-line no-alert
    if (!confirm(`${page.data.t('sentence.delete')}?`)) return
    await sentence._delete()
    await goto(sentences_scope_href)
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

    {#if can_edit}
      <div class="actions">
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

  .actions {
    margin-top: 1.5rem;
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
