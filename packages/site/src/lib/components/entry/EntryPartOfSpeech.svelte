<script lang="ts">
  import type { SelectOption } from '$lib/components/ui/array/select-options.interface'
  import ModalEditableArray from '$lib/components/ui/array/ModalEditableArray.svelte'
  import { page } from '$app/state'
  import { mayanDictionaries, mayanPOS, partsOfSpeech } from '$lib/mappings/parts-of-speech'

  interface Props {
    value?: string[];
    can_edit?: boolean;
    dictionaryId?: string;
    showPlus?: boolean;
    on_update: (new_value: string[]) => void;
  }

  let {
    value = [],
    can_edit = false,
    dictionaryId = undefined,
    showPlus = true,
    on_update
  }: Props = $props();

  let parts_of_speech_options = $derived(partsOfSpeech.map(part => ({
    value: part.enAbbrev,
    name: page.data.t({ dynamicKey: `ps.${part.enAbbrev}`, fallback: part.enName }),
  })) satisfies SelectOption[])

  const mayan_pos_options: SelectOption[] = mayanPOS.map((pos) => {
    return {
      value: pos,
      name: pos,
    }
  })

  let options = $derived(mayanDictionaries.includes(dictionaryId)
    ? [...parts_of_speech_options, ...mayan_pos_options]
    : parts_of_speech_options)
</script>

<ModalEditableArray
  values={value}
  {options}
  {can_edit}
  {showPlus}
  placeholder={page.data.t('entry_field.parts_of_speech')}
  {on_update}>
  {#snippet heading()}
    <span >{page.data.t('entry_field.parts_of_speech')}</span>
  {/snippet}
</ModalEditableArray>
