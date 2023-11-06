<script lang="ts">
  import { page } from '$app/stores';
  import {
    partsOfSpeech,
    mayanPOS,
    mayanDictionaries,
  } from '$lib/mappings/parts-of-speech';
  import { createEventDispatcher } from 'svelte';
  import ModalEditableArray from '../ui/array/ModalEditableArray.svelte';
  import type { SelectOption } from '../ui/array/select-options.interface';
  import { EntryFields } from '@living-dictionaries/types';

  export let value: string[] = [];
  export let canEdit = false;
  export let dictionaryId: string = undefined;
  export let showPlus = true;

  const dispatch = createEventDispatcher<{
    valueupdate: {
      field: EntryFields.parts_of_speech;
      newValue: string[];
    };
  }>();

  $: parts_of_speech_options = partsOfSpeech.map(part => {
    return {
      value: part.enAbbrev,
      name: $page.data.t('ps.' + part.enAbbrev, { fallback: part.enName }),
    };
  }) as SelectOption[];

  const mayan_pos_options: SelectOption[] = mayanPOS.map(pos => {
    return {
      value: pos,
      name: pos,
    };
  });

  $: options = mayanDictionaries.includes(dictionaryId)
    ? [...parts_of_speech_options, ...mayan_pos_options]
    : parts_of_speech_options;
</script>

<ModalEditableArray
  values={value}
  {options}
  {canEdit}
  {showPlus}
  placeholder={$page.data.t('entry.ps')}
  on:update={({ detail: newValue }) => {
    dispatch('valueupdate', {
      field: EntryFields.parts_of_speech,
      newValue,
    });
  }}>
  <span slot="heading">{$page.data.t('entry.ps')}</span>
</ModalEditableArray>

