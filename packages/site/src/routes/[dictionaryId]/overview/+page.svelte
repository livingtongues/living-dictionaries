<script lang="ts">
  import DisplayString from './DisplayString.svelte'
  import VisualMap from './VisualMap.svelte'
  import Image from '$lib/components/image/Image.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { page } from '$app/stores'
  import { glossingLanguages } from '$lib/glosses/glossing-languages'

  export let data
  const { dictionary } = data
  $: activeGlossingBcps = Array.isArray($dictionary.glossLanguages)
    ? $dictionary.glossLanguages.map(bcp =>
      $page.data.t({ dynamicKey: `gl.${bcp}`, fallback: glossingLanguages[bcp].vernacularName }),
    )
    : []
</script>

<div style="max-width: 700px">
  <h3 class="text-xl font-semibold mb-4">Overview</h3> <!-- TODO translate -->

  <DisplayString display="ISO 639-3" value={$dictionary.iso6393} />
  <DisplayString display="Glottocode" value={$dictionary.glottocode} />
  <DisplayString display="{$page.data.t('settings.translations')}" value={activeGlossingBcps} />
  <DisplayString display="{$page.data.t('create.alternate_names')}" value={$dictionary.alternateNames} />
  <DisplayString display={$page.data.t('dictionary.location')} value={$dictionary.location} />
  <VisualMap coordinates={$dictionary.coordinates} />
  <div class="mb-5" />
  {#if $dictionary.featuredImage}
    <div class="text-sm font-medium text-gray-700 mb-2">
      {$page.data.t('settings.featured_image')}
    </div>
    <Image
      can_edit={false}
      height={300}
      title="{$dictionary.name} Featured Image"
      gcs={$dictionary.featuredImage.specifiable_image_url}
      on_delete_image={null} />
  {/if}
  <div class="mb-5" />
</div>

<SeoMetaTags
  title="Overview"
  dictionaryName={$dictionary.name}
  description="Overview Description."
  keywords="Parameters, ISO 639-3, Glottocde, glossing languages, alternate names, GPS, language medata, public dictionary, private dictionary, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />
