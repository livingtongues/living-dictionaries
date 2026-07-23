<script lang="ts">
  import { page } from '$app/state'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { get_headword } from '$lib/orthography/orthographies'
  import type { DictRowType } from '$lib/db/dict-client/dict-live-db.svelte'
  import IconCarbonDocument from '~icons/carbon/document'
  import IconFaSolidPlus from '~icons/fa-solid/plus'
  import IconSvgSpinners3DotsFade from '~icons/svg-spinners/3-dots-fade'

  const { data } = $props()
  const { dictionary, can_edit } = $derived(data)
  const dict_db = $derived(page.data.dict_db)

  const all_texts = $derived([...(dict_db?.texts.rows ?? [])]
    .sort((first, second) => (second.updated_at || '').localeCompare(first.updated_at || '')))
  const sentences = $derived(dict_db?.sentences.rows ?? [])
  const loading = $derived(dict_db?.texts.loading ?? true)

  // text_id → its tag rows (via the text_tags junction). Plain records — these are
  // rebuilt every derivation, so they don't need SvelteMap reactivity.
  const tags_by_text = $derived.by(() => {
    const tag_of: Record<string, DictRowType<'tags'>> = {}
    for (const tag of dict_db?.tags.rows ?? []) tag_of[tag.id] = tag
    const grouped: Record<string, DictRowType<'tags'>[]> = {}
    for (const link of dict_db?.text_tags.rows ?? []) {
      const tag = tag_of[link.tag_id]
      if (!tag) continue
      ;(grouped[link.text_id] ??= []).push(tag)
    }
    return grouped
  })

  // Distinct tags in use across texts → the filter chip row.
  const filter_tags = $derived.by(() => {
    const seen: Record<string, DictRowType<'tags'>> = {}
    for (const list of Object.values(tags_by_text)) {
      for (const tag of list) seen[tag.id] = tag
    }
    return Object.values(seen).sort((first, second) => (first.name || '').localeCompare(second.name || ''))
  })

  let filter_tag_id = $state<string | null>(null)

  const texts = $derived(filter_tag_id
    ? all_texts.filter(text => (tags_by_text[text.id] ?? []).some(tag => tag.id === filter_tag_id))
    : all_texts)

  function sentence_count(text_id: string): number {
    return sentences.filter(sentence => sentence.text_id === text_id).length
  }

  function display_title(title: Record<string, string> | null): string {
    return get_headword({ lexeme: title, orthographies: dictionary.orthographies }).value
      || page.data.t('text.untitled')
  }

  function kind_label(kind: string | null): string {
    return kind ? page.data.t({ dynamicKey: `text_tag.${kind}`, fallback: kind }) : ''
  }
</script>

<div class="texts-page">
  <div class="heading-row">
    <h2>{page.data.t('dictionary.texts')}</h2>
    {#if can_edit}
      <HeadlessButton class="btn-primary btn-default" href={`/${dictionary.url}/texts/new`}>
        <IconFaSolidPlus style="margin-top: -0.25rem" />
        {page.data.t('text.new')}
      </HeadlessButton>
    {/if}
  </div>

  {#if filter_tags.length}
    <div class="filter-row">
      <button type="button" class="filter-chip" class:active={!filter_tag_id} onclick={() => filter_tag_id = null}>
        {page.data.t('text_tag.filter_all')}
      </button>
      {#each filter_tags as tag (tag.id)}
        <button
          type="button"
          class="filter-chip"
          class:active={filter_tag_id === tag.id}
          onclick={() => filter_tag_id = filter_tag_id === tag.id ? null : tag.id}>
          <span class="chip-kind">{kind_label(tag.kind)}</span>
          {tag.name}
        </button>
      {/each}
    </div>
  {/if}

  {#if texts.length}
    <div class="text-cards">
      {#each texts as text (text.id)}
        <a class="card" href={`/${dictionary.url}/text/${text.id}`}>
          <IconCarbonDocument style="font-size: 1.5rem; opacity: 0.6" />
          <div class="card-body">
            <div class="title">{display_title(text.title)}</div>
            <div class="meta">
              {page.data.t('text.sentence_count', { values: { count: String(sentence_count(text.id)) } })}
              · {new Date(text.updated_at).toLocaleDateString()}
            </div>
            {#if (tags_by_text[text.id] ?? []).length}
              <div class="card-tags">
                {#each tags_by_text[text.id] ?? [] as tag (tag.id)}
                  <span class="card-tag">{tag.name}</span>
                {/each}
              </div>
            {/if}
          </div>
        </a>
      {/each}
    </div>
  {:else if loading}
    <div class="state-note"><IconSvgSpinners3DotsFade /></div>
  {:else}
    <div class="state-note">{page.data.t('text.none_yet')}</div>
  {/if}
</div>

<style>
  .texts-page {
    padding-top: 0.5rem;
    max-width: 46rem;
  }

  .heading-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  h2 {
    font-size: 1.375rem;
    font-weight: 600;
  }

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: 1rem;
  }

  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 999px;
    border: 1px solid var(--border-color);
    background: var(--background);
    color: var(--color);
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .filter-chip:hover {
    border-color: var(--primary);
  }

  .filter-chip.active {
    background: color-mix(in srgb, var(--primary) 14%, var(--background));
    border-color: var(--primary);
    color: var(--primary);
  }

  .chip-kind {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--color-secondary);
  }

  .filter-chip.active .chip-kind {
    color: color-mix(in srgb, var(--primary) 70%, var(--color));
  }

  .text-cards {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.375rem;
  }

  .card-tag {
    font-size: 0.6875rem;
    padding: 0.0625rem 0.4rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--primary) 10%, var(--background));
    color: var(--primary);
  }

  .card {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.875rem;
    background: var(--surface);
    border-radius: 0.75rem;
    text-decoration: none;
    color: var(--color);
    transition: transform 75ms, opacity 75ms;
  }

  .card:active {
    transform: scale(0.985);
    opacity: 0.75;
  }

  .title {
    font-size: 1.0625rem;
    font-weight: 500;
  }

  .meta {
    font-size: 0.8125rem;
    color: var(--color-secondary);
    margin-top: 0.125rem;
  }

  .state-note {
    padding: 2rem 0;
    color: var(--color-secondary);
  }
</style>

<SeoMetaTags
  norobots={!dictionary.public}
  admin={data.auth_user.admin_level > 0}
  title={page.data.t('dictionary.texts')}
  dictionaryName={dictionary.name}
  description="Texts in this Living Dictionary." />
