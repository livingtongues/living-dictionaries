<script lang="ts">
  import type { EntryData, Tables } from '$lib/types'
  import Image from '$lib/components/image/Image.svelte'
  import { order_glosses } from '$lib/helpers/glosses'
  import { get_headword } from '$lib/helpers/orthographies'
  import { page } from '$app/state'

  interface Props {
    entry: EntryData
    can_edit?: boolean
    dictionary: Tables<'dictionaries'>
  }

  const { entry, can_edit = false, dictionary }: Props = $props()

  const { dbOperations } = $derived(page.data)

  const glosses = $derived(order_glosses({
    glosses: entry.senses?.[0]?.glosses,
    dictionary_gloss_languages: dictionary.gloss_languages,
    t: page.data.t,
    label: true,
  }))

  const first_photo = $derived(entry.senses?.[0]?.photos?.[0])
  const headword = $derived(get_headword({ lexeme: entry.main.lexeme, orthographies: dictionary.orthographies }))
</script>

{#if first_photo}
  <div class="gallery-card">
    <div class="photo-card">
      <div class="photo-frame">
        <Image
          square={480}
          title={headword.value}
          gcs={first_photo.serving_url}
          photo_source={first_photo.source}
          photographer={first_photo.photographer}
          page_context="gallery"
          {can_edit}
          on_delete_image={async () => await dbOperations.delete_photo(first_photo.id)} />
      </div>
      <a href="/{dictionary.url}/entry/{entry.id}" style="background: #f3f3f3;" class="caption">
        <div style="font-weight: 600">
          {headword.value}
        </div>
        <div class="gloss">
          {glosses[0] || ''}
        </div>
      </a>
    </div>
  </div>
{/if}

<style>
  .gallery-card {
    display: flex;
    flex-direction: column;
    position: relative;
    border-radius: 0.25rem;
    max-width: 500px;
  }

  .photo-card {
    background-color: color-mix(in srgb, var(--background), var(--color) 18%); /* ≈ gray-300 */
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); /* shadow */
  }

  .photo-frame {
    aspect-ratio: 1 / 1;
    overflow: hidden;
  }

  .caption {
    display: block;
    padding: 10px;
    height: 60px;
  }

  .gloss {
    font-size: 0.75rem;
    line-height: 1rem;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
  }
</style>
