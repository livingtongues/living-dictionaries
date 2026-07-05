<script lang="ts">
  import { page } from '$app/state'
  import { get_orthographies } from '$lib/helpers/orthographies'
  import IconIonMdVolumeHigh from '~icons/ion/md-volume-high'
  import IconCarbonImage from '~icons/carbon/image'
  import IconCarbonVideo from '~icons/carbon/video'
  import IconCarbonDocument from '~icons/carbon/document'

  interface SentenceHit {
    id: string
    document: {
      in_text: boolean
      has_audio: boolean
      has_image: boolean
      has_video: boolean
      _text_id: string | null
    }
  }

  interface Props {
    hits: SentenceHit[]
  }

  const { hits }: Props = $props()

  const { dictionary, dict_db } = $derived(page.data)
  const orthographies = $derived(get_orthographies(dictionary ?? {}))
  const texts_by_id = $derived(dict_db?.texts.objects ?? {})
</script>

<div class="sentence-results">
  {#each hits as hit (hit.id)}
    {@const sentence = dict_db?.sentences.id(hit.id)}
    {#if sentence}
      {@const parent_text = hit.document._text_id ? texts_by_id[hit.document._text_id] : null}
      <!-- In-text sentences deep-link into the reader anchored at the sentence (context beats isolation). -->
      <a class="card" href={hit.document._text_id ? `/${dictionary.url}/text/${hit.document._text_id}#${hit.id}` : `/${dictionary.url}/sentence/${hit.id}`}>
        {#each orthographies.all as orthography (orthography.code)}
          {@const value = sentence.text?.[orthography.code]}
          {#if value}
            <div class="vernacular">{value}</div>
          {/if}
        {/each}
        {#each Object.entries(sentence.translation || {}) as [locale, translation] (locale)}
          {#if translation}
            <div class="translation">{translation}</div>
          {/if}
        {/each}
        <div class="meta">
          {#if parent_text}
            <span class="badge"><IconCarbonDocument class="icon-inline" />
              {Object.values(parent_text.title || {}).find(Boolean) || ''}</span>
          {/if}
          {#if hit.document.has_audio}<IconIonMdVolumeHigh class="icon-inline" />{/if}
          {#if hit.document.has_image}<IconCarbonImage class="icon-inline" />{/if}
          {#if hit.document.has_video}<IconCarbonVideo class="icon-inline" />{/if}
        </div>
      </a>
    {/if}
  {/each}
</div>

<style>
  .sentence-results {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .card {
    display: block;
    padding: 0.75rem;
    background: var(--surface);
    border-radius: 0.75rem;
    text-decoration: none;
    color: var(--color);
    transition: transform 75ms, opacity 75ms;
  }

  .card:active {
    transform: scale(0.975);
    opacity: 0.75;
  }

  .vernacular {
    font-size: 1.0625rem;
    font-weight: 500;
  }

  .translation {
    margin-top: 0.125rem;
    color: var(--color-secondary);
    font-size: 0.9375rem;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.375rem;
    font-size: 0.75rem;
    color: var(--color-secondary);
  }

  .meta:empty {
    display: none;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
</style>
