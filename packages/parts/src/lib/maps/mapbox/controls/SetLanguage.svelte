<script lang="ts">
  import { getContext } from 'svelte';
  import { mapKey } from '../context';
  import type { Map } from 'mapbox-gl';

  const { getMap } = getContext(mapKey);
  const map: Map = getMap();

  const supportedLanguages = [
    'ar',
    'en',
    'es',
    'fr',
    'de',
    'it',
    'pt',
    'ru',
    'zh-Hans',
    'zh-Hant',
    'ja',
    'ko',
    'vi',
  ] as const;

  type SupportedLanguages = typeof supportedLanguages[number]
  export let bcp: SupportedLanguages = 'en';

  $: if (bcp !== 'en') {
    map.setLayoutProperty('country-label', 'text-field', ['get', `name_${bcp}`]);
  }
</script>
