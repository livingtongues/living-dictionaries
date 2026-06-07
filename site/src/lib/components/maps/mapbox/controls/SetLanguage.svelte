<script lang="ts">
  import { run } from 'svelte/legacy'

  import { getContext } from 'svelte'
  import { mapKey } from '../context'
  import type { MapKeyContext } from '../context'

  const { getMap } = getContext<MapKeyContext>(mapKey)
  const map = getMap()

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
  ] as const

  type SupportedLanguages = typeof supportedLanguages[number]
  interface Props {
    bcp?: SupportedLanguages
  }

  const { bcp = 'en' }: Props = $props()

  run(() => {
    if (bcp !== 'en')
      map.setLayoutProperty('country-label', 'text-field', ['get', `name_${bcp}`])
  })

</script>
