<script lang="ts">
  import { getContext } from 'svelte'
  import { map_key } from '../context'
  import type { MapKeyContext } from '../context'

  const { get_map } = getContext<MapKeyContext>(map_key)
  const map = get_map()

  const supported_languages = [
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
  ] as const

  type SupportedLanguages = typeof supported_languages[number]
  interface Props {
    bcp?: SupportedLanguages
  }

  const { bcp = 'en' }: Props = $props()

  $effect(() => {
    if (bcp !== 'en')
      map.setLayoutProperty('country-label', 'text-field', ['get', `name_${bcp}`])
  })

</script>
