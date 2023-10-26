<script lang="ts">
  import { EntryFields, type EntryFieldValue, type ExpandedEntry, type IDictionary, type History } from '@living-dictionaries/types';
  import { t } from 'svelte-i18n';
  import EntryField from './EntryField.svelte';
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte';
  import EntrySemanticDomains from '$lib/components/entry/EntrySemanticDomains.svelte';
  import { createEventDispatcher } from 'svelte';
  import EntryDialect from '$lib/components/entry/EntryDialect.svelte';
  import { order_entry_and_dictionary_gloss_languages } from '$lib/helpers/glosses';
  import { DICTIONARIES_WITH_VARIANTS } from '$lib/constants';
  import EntryMedia from './EntryMedia.svelte';
  import SelectSource from '$lib/components/entry/EntrySource.svelte';
  import EntryHistory from './EntryHistory.svelte';

  export let entry: ExpandedEntry;
  export let dictionary: IDictionary;
  export let canEdit = false;
  export let videoAccess = false;
  export let history: History[];

  const dispatch = createEventDispatcher<{
    valueupdate: { field: string; newValue: string | string[] };
  }>();

  const regularFields: EntryFieldValue[] = ['plural_form', 'morphology', 'interlinearization', 'notes']
</script>

<div class="flex flex-col md:flex-row-reverse mb-3">
  <div class="md:hidden" dir="ltr">
    <EntryField
      value={entry.lexeme}
      field="lexeme"
      {canEdit}
      display={$t('entry.lx', { default: 'Lexeme/Word/Phrase' })}
      on:update={({detail}) => dispatch('valueupdate', { field: EntryFields.lexeme, newValue: detail})} />
  </div>

  <div class="md:w-1/3 flex flex-col mt-2">
    <EntryMedia {dictionary} {entry} {canEdit} {videoAccess} on:deleteImage on:deleteVideo on:valueupdate />
    <EntryHistory {history} class="mt-5 hidden md:block" />
  </div>

  <div class="hidden md:block w-1" />

  <div class="md:w-2/3 flex flex-col">
    <div class="hidden md:block">
      <EntryField
        value={entry.lexeme}
        field="lexeme"
        {canEdit}
        display={$t('entry.lx', { default: 'Lexeme/Word/Phrase' })}
        on:update={({detail}) => dispatch('valueupdate', { field: EntryFields.lexeme, newValue: detail})} />
    </div>

    {#each dictionary.alternateOrthographies || [] as orthography, index}
      {@const orthographyIndex = `local_orthography_${index + 1}`}
      <EntryField
        value={entry[orthographyIndex]}
        field="local_orthography"
        {canEdit}
        display={orthography}
        on:update={({detail}) => dispatch('valueupdate', { field: orthographyIndex, newValue: detail})} />
    {/each}

    <EntryField value={entry.phonetic} field="phonetic" {canEdit} display={$t('entry.ph')} on:update={({detail}) => dispatch('valueupdate', { field: EntryFields.phonetic, newValue: detail})} />

    {#each entry.senses as sense}
      <!-- {#each entry.senses as sense, index} -->
      {@const glossingLanguages = order_entry_and_dictionary_gloss_languages(sense.glosses, dictionary.glossLanguages)}
      <!-- <div class="p-2 hover:bg-gray-50 rounded"> -->

      <!-- {#if entry.senses.length > 1 || canEdit}
        <div class="font-semibold mb-2 flex">
          <div class="font-semibold">
            Sense {index + 1}
          </div>
          <div class="mx-auto" />
          {#if canEdit}
            {#if index > 0}
              <Button size="sm" form="menu" onclick={() => alert('Re-ordering not ready yet.')}><span class="i-fa-chevron-up -mt-1" /></Button>
            {/if}
            {#if index < entry.senses.length - 1}
              <Button size="sm" form="menu" onclick={() => alert('Re-ordering not ready yet.')}><span class="i-fa-chevron-down -mt-1" /></Button>
            {/if}
            {#if entry.senses.length > 1}
              <Button size="sm" form="menu" onclick={() => alert('Delete sense feature not ready yet.')}><span class="i-fa-solid-times -mt-1" /></Button>
            {/if}
            <Button size="sm" form="menu" onclick={() => alert('Ability to add additional senses coming soon.')}><span class="i-fa-solid-plus -mt-1" /></Button>
          {/if}
        </div>
      {/if} -->

      <!-- <div class="flex flex-col border-l-2"> -->
      {#each glossingLanguages as bcp}
        <EntryField
          value={sense.glosses?.[bcp]}
          field="gloss"
          {bcp}
          {canEdit}
          display={`${$t(`gl.${bcp}`)}: ${$t('entry.gloss', { default: 'Gloss' })}`}
          on:update={({detail}) => dispatch('valueupdate', { field: `gl.${bcp}`, newValue: detail})} />
      {/each}

      <!-- Only in Bahasa Lani (id: jaRhn6MAZim4Blvr1iEv) -->
      {#if sense.definition_english}
        <EntryField
          value={sense.definition_english}
          field="definition_english"
          {canEdit}
          display="Definition (deprecated)"
          on:update={({detail}) => dispatch('valueupdate', { field: EntryFields.definition_english, newValue: detail})} />
      {/if}

      {#if sense.translated_parts_of_speech?.length || canEdit}
        <div class="md:px-2" class:order-2={!sense.translated_parts_of_speech?.length}>
          <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$t('entry.ps')}</div>
          <EntryPartOfSpeech value={sense.translated_parts_of_speech} {canEdit} on:valueupdate />
          <div class="border-b-2 pb-1 mb-2 border-dashed" />
        </div>
      {/if}

      {@const hasSemanticDomain = sense.translated_ld_semantic_domains?.length || sense.write_in_semantic_domains?.length}
      {#if hasSemanticDomain || canEdit}
        <div class="md:px-2" class:order-2={!hasSemanticDomain}>
          <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$t('entry.sdn')}</div>
          <EntrySemanticDomains {canEdit} {sense} on:valueupdate />
          <div class="border-b-2 pb-1 mb-2 border-dashed" />
        </div>
      {/if}

      <EntryField
        value={sense.noun_class}
        field="noun_class"
        {canEdit}
        display={$t('entry.nc')}
        on:update={({detail}) => dispatch('valueupdate', { field: EntryFields.noun_class, newValue: detail})} />

      {#each sense.example_sentences || [{}] as sentence}
        <EntryField
          value={sentence.vn}
          field="example_sentence"
          {canEdit}
          display={$t('entry.example_sentence', { default: 'Example Sentence' })}
          on:update={({detail}) => dispatch('valueupdate', { field: 'xs.vn', newValue: detail})} />

        {#each glossingLanguages as bcp}
          <EntryField
            value={sentence[bcp]}
            field="example_sentence"
            {bcp}
            {canEdit}
            display={`${$t(`gl.${bcp}`)}: ${$t('entry.example_sentence', {
              default: 'Example Sentence',
            })}`}
            on:update={({detail}) => dispatch('valueupdate', { field: `xs.${bcp}`, newValue: detail})} />
        {/each}
      {/each}
      <!-- </div> -->
      <!-- </div> -->
    {/each}

    {#if entry.dialects?.length || canEdit}
      <div class="md:px-2" class:order-2={!entry.dialects?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$t('entry.di')}</div>
        <EntryDialect {canEdit} dialects={entry.dialects} dictionaryId={dictionary.id} on:valueupdate />
        <div class="border-b-2 pb-1 mb-2 border-dashed" />
      </div>
    {/if}

    <!-- TODO: make multiple with generic component -->
    <EntryField
      value={entry.scientific_names?.[0]}
      field="scientific_names"
      {canEdit}
      display={$t('entry.scn', { default: 'Scientific Name' })}
      on:update={({ detail }) => dispatch('valueupdate', { field: EntryFields.scientific_names, newValue: [detail] })} />

    {#if DICTIONARIES_WITH_VARIANTS.includes(dictionary.id)}
      <EntryField
        value={entry.variant}
        field="variant"
        {canEdit}
        display={$t(`entry.va`, { default: 'Variant' })}
        on:update={({detail}) => dispatch('valueupdate', { field: EntryFields.variant, newValue: detail})} />
    {/if}

    {#each regularFields as field}
      <EntryField
        value={entry[field]}
        {field}
        {canEdit}
        display={$t(`entry.${EntryFields[field]}`)}
        on:update={({detail}) => dispatch('valueupdate', { field: EntryFields[field], newValue: detail})} />
    {/each}

    {#if entry.sources?.length || canEdit}
      <div class="md:px-2" class:order-2={!entry.sources?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$t('entry.sr')}</div>
        <SelectSource
          {canEdit}
          value={entry.sources}
          on:valueupdate />
        <div class="border-b-2 pb-1 mb-2 border-dashed" />
      </div>
    {/if}
  </div>
</div>

<EntryHistory {history} class="mt-3 md:hidden" />
