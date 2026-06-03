<script lang="ts">
  import type { SelectOption } from '$lib/components/ui/array/select-options.interface'
  import ModalEditableArray from '$lib/components/ui/array/ModalEditableArray.svelte'
  import { page } from '$app/stores'
  import { mayanDictionaries, mayanPOS, partsOfSpeech } from '$lib/mappings/parts-of-speech'

  export let value: string[] = []
  export let can_edit = false
  export let dictionaryId: string = undefined
  export let showPlus = true
  export let on_update: (new_value: string[]) => void

  $: parts_of_speech_options = partsOfSpeech.map(part => ({
    value: part.enAbbrev,
    name: $page.data.t({ dynamicKey: `ps.${part.enAbbrev}`, fallback: part.enName }),
  })) satisfies SelectOption[]

  const mayan_pos_options: SelectOption[] = mayanPOS.map((pos) => {
    return {
      value: pos,
      name: pos,
    }
  })

  $: options = mayanDictionaries.includes(dictionaryId)
    ? [...parts_of_speech_options, ...mayan_pos_options]
    : parts_of_speech_options
</script>

<ModalEditableArray
  values={value}
  {options}
  {can_edit}
  {showPlus}
  placeholder={$page.data.t('entry_field.parts_of_speech')}
  {on_update}>
  <span slot="heading">{$page.data.t('entry_field.parts_of_speech')}</span>
</ModalEditableArray>
