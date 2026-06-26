<script lang="ts">
  import type { EntryData, Tables } from '@living-dictionaries/types'
  import Image from '$lib/components/image/Image.svelte'
  import { order_glosses } from '$lib/helpers/glosses'
  import { page } from '$app/stores'

  export let entry: EntryData
  export let can_edit = false
  export let dictionary: Tables<'dictionaries'>

  $: ({ dbOperations } = $page.data)

  $: glosses = order_glosses({
    glosses: entry.senses?.[0]?.glosses,
    dictionary_gloss_languages: dictionary.gloss_languages,
    t: $page.data.t,
    label: true,
  })

  $: first_photo = entry.senses?.[0]?.photos?.[0]
</script>

{#if first_photo}
  <div class="flex flex-col relative rounded max-w-[500px]">
    <div class="bg-gray-300 shadow">
      <div class="aspect-square overflow-hidden">
        <Image
          square={480}
          title={entry.main.lexeme.default}
          gcs={first_photo.serving_url}
          photo_source={first_photo.source}
          photographer={first_photo.photographer}
          page_context="gallery"
          {can_edit}
          on_delete_image={async () => await dbOperations.update_photo({ deleted: new Date().toISOString(), id: first_photo.id })} />
      </div>
      <a href="/{dictionary.url}/entry/{entry.id}" style="background: #f3f3f3;" class="block p-[10px] h-60px">
        <div class="font-semibold">
          {entry.main.lexeme.default}
        </div>
        <div class="text-xs line-clamp-1">
          {glosses[0] || ''}
        </div>
      </a>
    </div>
  </div>
{/if}
