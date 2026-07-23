<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { split_text_into_sentences } from '$lib/corpus/split-text-into-sentences'
  import { get_orthographies } from '$lib/orthography/orthographies'
  import IconFa6SolidArrowLeft from '~icons/fa6-solid/arrow-left'
  import IconFa6SolidArrowTurnUp from '~icons/fa6-solid/arrow-turn-up'
  import IconSystemUiconsTrash from '~icons/system-uicons/trash'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  const { data } = $props()
  const { dictionary, can_edit } = $derived(data)
  const dict_db = $derived(page.data.dict_db)

  const orthographies = $derived(get_orthographies(dictionary ?? {}))

  let phase = $state<'paste' | 'adjust'>('paste')
  let title = $state('')
  let body = $state('')
  let orthography_code = $state<string | null>(null)
  const active_orthography = $derived(orthography_code ?? orthographies.primary.code)
  let rows = $state<{ text: string, ends_paragraph: boolean }[]>([])
  let saving = $state(false)

  const preview = $derived(split_text_into_sentences(body))
  const preview_paragraphs = $derived(preview.filter(sentence => sentence.ends_paragraph).length + (preview.length ? 1 : 0))

  function continue_to_adjust() {
    rows = preview.map(sentence => ({ ...sentence }))
    phase = 'adjust'
  }

  function back_to_paste() {
    if (rows.length && !confirm(page.data.t('text.resplit_warning'))) return
    phase = 'paste'
  }

  function merge_up(index: number) {
    if (index === 0) return
    rows[index - 1].text = `${rows[index - 1].text} ${rows[index].text}`.trim()
    rows[index - 1].ends_paragraph = rows[index].ends_paragraph
    rows.splice(index, 1)
  }

  async function create_text() {
    if (saving) return
    const kept = rows.map(row => ({ ...row, text: row.text.trim() })).filter(row => row.text)
    if (!title.trim() || !kept.length) return
    saving = true
    try {
      const text = await dict_db.writes.insert_text({
        title: { [active_orthography]: title.trim() },
        sentences: kept.map(row => ({
          text: { [active_orthography]: row.text },
          ...row.ends_paragraph ? { ends_paragraph: 1 } : {},
        })),
      })
      await goto(`/${dictionary.url}/text/${text.id}`)
    } catch (err) {
      alert(err)
      console.error(err)
      saving = false
    }
  }
</script>

<div class="new-text-page">
  <nav class="breadcrumb">
    <a href={`/${dictionary.url}/texts`}>{page.data.t('dictionary.texts')}</a>
    <span class="crumb-sep">/</span>
    <span>{page.data.t('text.new')}</span>
  </nav>

  {#if can_edit}
    <label for="text-title">{page.data.t('text.title')}</label>
    <input
      id="text-title"
      type="text"
      autocomplete="off"
      bind:value={title}
      placeholder={page.data.t('text.title')} />

    {#if orthographies.alternates.length}
      <label for="text-orthography">{page.data.t('entry_field.local_orthography')}</label>
      <select id="text-orthography" bind:value={orthography_code}>
        {#each orthographies.all as orthography (orthography.code)}
          <option value={orthography.code === orthographies.primary.code ? null : orthography.code}>
            {orthography.name || orthography.code}
          </option>
        {/each}
      </select>
    {/if}

    {#if phase === 'paste'}
      <label for="text-body">{page.data.t('text.paste_body')}</label>
      <textarea id="text-body" rows="12" bind:value={body}></textarea>
      <div class="detected">
        {#if preview.length}
          {page.data.t('text.detected', { values: { count: String(preview.length), paragraphs: String(preview_paragraphs) } })}
        {/if}
      </div>
      <div class="actions">
        <HeadlessButton class="btn-primary btn-default" disabled={!preview.length || !title.trim()} onclick={continue_to_adjust}>
          {page.data.t('text.adjust')}
        </HeadlessButton>
      </div>
    {:else}
      <div class="adjust-head">
        <button type="button" class="btn-outline btn-sm" onclick={back_to_paste}>
          <IconFa6SolidArrowLeft />
          {page.data.t('text.back_to_paste')}
        </button>
        <span class="detected">{page.data.t('text.detected', { values: { count: String(rows.filter(row => row.text.trim()).length), paragraphs: String(rows.filter(row => row.ends_paragraph).length + (rows.length ? 1 : 0)) } })}</span>
      </div>

      <div class="sentence-rows">
        {#each rows as row, index (index)}
          <div class="sentence-row" class:paragraph-end={row.ends_paragraph}>
            <span class="row-number">{index + 1}</span>
            <textarea rows="1" bind:value={row.text}></textarea>
            <div class="row-actions">
              {#if index > 0}
                <button type="button" class="row-action" title={page.data.t('text.merge_up')} onclick={() => merge_up(index)}>
                  <IconFa6SolidArrowTurnUp />
                </button>
              {/if}
              <button
                type="button"
                class="row-action"
                class:active-toggle={row.ends_paragraph}
                title={page.data.t('text.paragraph_break')}
                onclick={() => row.ends_paragraph = !row.ends_paragraph}>
                ¶
              </button>
              <button type="button" class="row-action" title={page.data.t('text.remove_sentence')} onclick={() => rows.splice(index, 1)}>
                <IconSystemUiconsTrash />
              </button>
            </div>
          </div>
        {/each}
      </div>

      <div class="actions">
        <button type="button" class="btn-outline btn-sm" onclick={() => rows.push({ text: '', ends_paragraph: false })}>
          <IconFaSolidPlus />
          {page.data.t('sentence.add')}
        </button>
        <span style="flex-grow: 1"></span>
        <HeadlessButton class="btn-primary btn-default" loading={saving} disabled={!title.trim() || !rows.some(row => row.text.trim())} onclick={create_text}>
          {page.data.t('text.create')}
        </HeadlessButton>
      </div>
    {/if}
  {/if}
</div>

<style>
  .new-text-page {
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

  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 85%, var(--background));
    margin: 1rem 0 0.375rem;
  }

  input,
  select,
  textarea {
    width: 100%;
  }

  textarea {
    resize: vertical;
  }

  .detected {
    font-size: 0.8125rem;
    color: var(--color-secondary);
    margin-top: 0.375rem;
    min-height: 1.25rem;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .adjust-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin: 1rem 0 0.5rem;
  }

  .sentence-rows {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .sentence-row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    background: var(--surface);
    border-radius: 0.5rem;
  }

  /* A visible gap marks "a paragraph break follows this sentence". */
  .sentence-row.paragraph-end {
    margin-bottom: 1.125rem;
    border-bottom: 2px solid color-mix(in srgb, var(--color) 20%, var(--background));
  }

  .row-number {
    flex-shrink: 0;
    font-size: 0.6875rem;
    font-variant-numeric: tabular-nums;
    color: var(--color-secondary);
    padding-top: 0.5rem;
    min-width: 1.25rem;
    text-align: right;
  }

  .sentence-row textarea {
    flex-grow: 1;
    min-height: 2.25rem;
  }

  .row-actions {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    padding-top: 0.25rem;
  }

  .row-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.375rem;
    color: var(--color-secondary);
    font-size: 0.875rem;
  }

  .row-action:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%);
  }

  .row-action.active-toggle {
    background-color: var(--primary);
    color: var(--on-primary);
  }
</style>

<SeoMetaTags
  norobots={true}
  admin={data.auth_user.admin_level > 0}
  title={page.data.t('text.new')}
  dictionaryName={dictionary.name}
  description="Create a new text in this Living Dictionary." />
