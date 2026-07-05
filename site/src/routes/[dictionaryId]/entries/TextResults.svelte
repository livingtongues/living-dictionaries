<script lang="ts">
  import { page } from '$app/state'
  import IconCarbonDocument from '~icons/carbon/document'

  interface TextHit {
    id: string
  }

  interface Props {
    hits: TextHit[]
  }

  const { hits }: Props = $props()

  const { dictionary, dict_db } = $derived(page.data)
  // Dozens of texts per dict at most — counting sentences per card is cheap.
  const sentences = $derived(dict_db?.sentences.rows ?? [])
</script>

<div class="text-results">
  {#each hits as hit (hit.id)}
    {@const text = dict_db?.texts.id(hit.id)}
    {#if text}
      {@const sentence_count = sentences.filter(sentence => sentence.text_id === hit.id).length}
      <a class="card" href={`/${dictionary.url}/text/${hit.id}`}>
        <IconCarbonDocument class="icon-inline" style="font-size: 1.25rem; opacity: 0.6" />
        <div>
          <div class="title">{Object.values(text.title || {}).find(Boolean) || ''}</div>
          <div class="meta">{page.data.t('text.sentence_count', { values: { count: sentence_count } })}</div>
        </div>
      </a>
    {/if}
  {/each}
</div>

<style>
  .text-results {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
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
  }
</style>
