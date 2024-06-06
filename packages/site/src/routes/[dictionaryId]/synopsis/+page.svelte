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

  const { name, iso6393, glottocode, alternateNames, location, coordinates, featuredImage } = $dictionary
</script>

<div style="max-width: 700px">
  <h3 class="text-xl font-semibold mb-4">{$page.data.t('synopsis.name')}</h3>
  <DisplayString display="ISO 639-3" value={iso6393} />
  <DisplayString display="Glottocode" value={glottocode} />
  <DisplayString display={$page.data.t('synopsis.translations')} value={activeGlossingBcps} />
  <DisplayString display="{$page.data.t('create.alternate_names')}" value={alternateNames} />
  <DisplayString display={$page.data.t('dictionary.location')} value={location} />
  <VisualMap coordinates={coordinates} />
  <div class="mb-5" />
  {#if featuredImage}
    <div class="text-sm font-medium text-gray-700 mb-2">
      {$page.data.t('settings.featured_image')}
    </div>
    <Image
      can_edit={false}
      height={300}
      title="{name} Featured Image"
      gcs={featuredImage.specifiable_image_url}
      on_delete_image={null} />
  {/if}
  {#if !iso6393 && !glottocode && activeGlossingBcps?.length === 0 && !alternateNames && !location && !coordinates && !featuredImage}
    <i> {$page.data.t('home.no_results')} </i>
  {/if}
  <div class="mb-5" />
</div>

<SeoMetaTags
  title={$page.data.t('synopsis.name')}
  dictionaryName={name}
  description="View the parameters of this Living Dictionary, such as its name, ISO 639-3 Code, Glottocode, the translation languages present within this dictionary, the alternate names for this language, the geo-coordinates for this language, and more."
  keywords="Synopsis, Parameters, ISO 639-3, Glottocde, glossing languages, alternate names, GPS, language medata, public dictionary, private dictionary, Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />
