<script lang="ts">
  import { page } from '$app/state'
  import Button from '$lib/components/ui/Button.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { get_headword } from '$lib/helpers/orthographies'
  import IconCarbonDocument from '~icons/carbon/document'
  import IconFaSolidPlus from '~icons/fa-solid/plus'
  import IconSvgSpinners3DotsFade from '~icons/svg-spinners/3-dots-fade'

  const { data } = $props()
  const { dictionary, can_edit } = $derived(data)
  const dict_db = $derived(page.data.dict_db)

  const texts = $derived([...(dict_db?.texts.rows ?? [])]
    .sort((first, second) => (second.updated_at || '').localeCompare(first.updated_at || '')))
  const sentences = $derived(dict_db?.sentences.rows ?? [])
  const loading = $derived(dict_db?.texts.loading ?? true)

  function sentence_count(text_id: string): number {
    return sentences.filter(sentence => sentence.text_id === text_id).length
  }

  function display_title(title: Record<string, string> | null): string {
    return get_headword({ lexeme: title, orthographies: dictionary.orthographies }).value
      || page.data.t('text.untitled')
  }
</script>

<div class="texts-page">
  <div class="heading-row">
    <h2>{page.data.t('dictionary.texts')}</h2>
    {#if can_edit}
      <Button form="filled" href={`/${dictionary.url}/texts/new`}>
        <IconFaSolidPlus class="icon-inline" style="margin-top: -0.25rem" />
        {page.data.t('text.new')}
      </Button>
    {/if}
  </div>

  {#if texts.length}
    <div class="text-cards">
      {#each texts as text (text.id)}
        <a class="card" href={`/${dictionary.url}/text/${text.id}`}>
          <IconCarbonDocument class="icon-inline" style="font-size: 1.5rem; opacity: 0.6" />
          <div class="card-body">
            <div class="title">{display_title(text.title)}</div>
            <div class="meta">
              {page.data.t('text.sentence_count', { values: { count: String(sentence_count(text.id)) } })}
              · {new Date(text.updated_at).toLocaleDateString()}
            </div>
          </div>
        </a>
      {/each}
    </div>
  {:else if loading}
    <div class="state-note"><IconSvgSpinners3DotsFade class="icon-inline" /></div>
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

  .text-cards {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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
