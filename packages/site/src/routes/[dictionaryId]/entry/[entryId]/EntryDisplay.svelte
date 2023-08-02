<script lang="ts">
  import type { ExpandedEntry, IDictionary } from '@living-dictionaries/types';
  import { t } from 'svelte-i18n';
  import EntryField from './EntryField.svelte';
  import EntryPartOfSpeech from '$lib/components/entry/EntryPartOfSpeech.svelte';
  import EntrySemanticDomains from './EntrySemanticDomains.svelte';
  import { createEventDispatcher } from 'svelte';
  import EntryDialect from '$lib/components/entry/EntryDialect.svelte';
  import { BadgeArray, Button } from 'svelte-pieces';
  import { order_entry_and_dictionary_gloss_languages } from '$lib/helpers/glosses';
  import { DICTIONARIES_WITH_VARIANTS } from '$lib/constants';
  import EntryMedia from './EntryMedia.svelte';

  export let entry: ExpandedEntry;
  export let dictionary: IDictionary;
  export let canEdit = false;
  export let videoAccess = false;

  const dispatch = createEventDispatcher<{
    valueupdate: { field: string; newValue: string | string[] };
  }>();
</script>

<div class="flex flex-col md:flex-row-reverse mb-3">
  <div class="md:hidden" dir="ltr">
    <EntryField
      value={entry.lexeme}
      field="lx"
      {canEdit}
      display={$t('entry.lx', { default: 'Lexeme/Word/Phrase' })}
      on:valueupdate />
  </div>

  <div class="md:w-1/3 flex flex-col mt-2">
    <EntryMedia dictionaryId={dictionary.id} {entry} {canEdit} {videoAccess} on:deleteImage on:deleteVideo />
  </div>

  <div class="hidden md:block w-1" />

  <div class="md:w-2/3 flex flex-col">
    <div class="hidden md:block">
      <EntryField
        value={entry.lexeme}
        field="lx"
        {canEdit}
        display={$t('entry.lx', { default: 'Lexeme/Word/Phrase' })}
        on:valueupdate />
    </div>

    {#each dictionary.alternateOrthographies || [] as orthography, index}
      {@const orthographyIndex = `local_orthography_${index + 1}`}
      <EntryField
        value={entry[orthographyIndex]}
        field={orthographyIndex}
        {canEdit}
        display={orthography}
        on:valueupdate />
    {/each}

    <EntryField value={entry.phonetic} field="ph" {canEdit} display={$t('entry.ph')} on:valueupdate />

    {#each entry.senses as sense, index}
      {@const glossingLanguages = order_entry_and_dictionary_gloss_languages(sense.glosses, dictionary.glossLanguages)}
      <div class="p-2 hover:bg-gray-50 rounded">

        {#if entry.senses.length > 1 || canEdit}
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
        {/if}

        <div class="flex flex-col border-l-2">
          {#each glossingLanguages as bcp}
            <EntryField
              value={sense.glosses?.[bcp]}
              field={`gl.${bcp}`}
              {canEdit}
              display={`${$t(`gl.${bcp}`)}: ${$t('entry.gloss', {
                default: 'Gloss',
              })}`}
              on:valueupdate />
          {/each}

          <!-- Only in Bahasa Lani (id: jaRhn6MAZim4Blvr1iEv) -->
          {#if sense.definition_english}
            <EntryField
              value={sense.definition_english}
              field="de"
              {canEdit}
              display="Definition (deprecated)"
              on:valueupdate />
          {/if}

          {#if sense.translated_parts_of_speech?.length || canEdit}
            <div class="md:px-2" class:order-2={!sense.translated_parts_of_speech?.length}>
              <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$t('entry.ps')}</div>
              <EntryPartOfSpeech value={sense.translated_parts_of_speech} {canEdit} on:valueupdate />
              <div class="border-b-2 pb-1 mb-2" />
            </div>
          {/if}

          <EntrySemanticDomains {sense} {canEdit}
            on:update={({detail}) => dispatch('valueupdate', { field: 'sdn', newValue: detail })}
            on:removeCustomDomain={() => dispatch('valueupdate', { field: 'sd', newValue: null })} />

          <EntryField
            value={sense.noun_class}
            field="nc"
            {canEdit}
            display={$t('entry.nc')}
            on:valueupdate />

          {#each sense.example_sentences || [{}] as sentence}
            <EntryField
              value={sentence.vn}
              field="xs.vn"
              {canEdit}
              display={$t('entry.example_sentence', { default: 'Example Sentence' })}
              on:valueupdate />

            {#each glossingLanguages as bcp}
              <EntryField
                value={sentence[bcp]}
                field={`xs.${bcp}`}
                {canEdit}
                display={`${$t(`gl.${bcp}`)}: ${$t('entry.example_sentence', {
                  default: 'Example Sentence',
                })}`}
                on:valueupdate />
            {/each}
          {/each}
        </div>
      </div>
    {/each}

    {#if entry.dialects?.length || canEdit}
      <div class="md:px-2" class:order-2={!entry.dialects?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$t('entry.di')}</div>
        <EntryDialect {canEdit} dialects={entry.dialects} on:valueupdate />
        <div class="border-b-2 pb-1 mb-2" />
      </div>
    {/if}

    <!-- TODO: make multiple with generic component -->
    <EntryField
      value={entry.scientific_names?.[0]}
      field="scn"
      {canEdit}
      display={$t('entry.scn', { default: 'Scientific Name' })}
      on:valueupdate={({ detail }) =>
        dispatch('valueupdate', { field: 'scn', newValue: [detail.newValue] })} />

    {#if DICTIONARIES_WITH_VARIANTS.includes(dictionary.id)}
      <EntryField
        value={entry.variant}
        field="va"
        {canEdit}
        display={$t(`entry.va`, { default: 'Variant' })}
        on:valueupdate />
    {/if}

    {#each Object.entries({'pl': 'plural_form', 'mr': 'morphology', 'in': 'interlinearization', 'nt': 'notes'}) as [databaseField, expandedField]}
      <EntryField
        value={entry[expandedField]}
        field={databaseField}
        {canEdit}
        display={$t(`entry.${databaseField}`)}
        on:valueupdate />
    {/each}

    {#if entry.sources?.length || canEdit}
      <div class="md:px-2" class:order-2={!entry.sources?.length}>
        <div class="rounded text-xs text-gray-500 mt-1 mb-2">{$t('entry.sr')}</div>
        <BadgeArray
          strings={entry.sources}
          {canEdit}
          promptMessage={$t('entry.sr')}
          addMessage={$t('misc.add', { default: 'Add' })}
          on:valueupdated={(e) => dispatch('valueupdate', { field: 'sr', newValue: e.detail })} />
        <div class="border-b-2 pb-1 mb-2" />
      </div>
    {/if}
  </div>
</div>
