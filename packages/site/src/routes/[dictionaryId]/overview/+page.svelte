<script lang="ts">
  import DisplayString from './DisplayString.svelte'
  import VisualMap from './VisualMap.svelte'
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
</div>
