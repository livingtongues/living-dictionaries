<script lang="ts" context="module">
  import { type Writable, writable } from 'svelte/store'
  import type { SelectOption } from '../ui/array/select-options.interface'

  const options: Writable<SelectOption[]> = writable([])
// let fetchedDictionaryId: string
</script>

<script lang="ts">
  import ModalEditableArray from '../ui/array/ModalEditableArray.svelte'
  import { page } from '$app/stores'
  // import { onMount } from 'svelte'
  // import { browser } from '$app/environment'

  export let dialects: string[] = []
  export let can_edit = false
  export let dictionaryId: string
  export let showPlus = true

  export let on_update: (new_value: string[]) => void

// onMount(() => {
  //   if (browser && fetchedDictionaryId !== dictionaryId) {
  //   }
  // })
</script>

<ModalEditableArray
  values={dialects}
  options={$options}
  {can_edit}
  canWriteIn
  {showPlus}
  placeholder={$page.data.t('entry_field.dialects')}
  {on_update}>
  <span slot="heading">{$page.data.t('entry_field.dialects')}</span>
</ModalEditableArray>
