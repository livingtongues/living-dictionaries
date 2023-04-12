<script lang="ts">
  import { t } from 'svelte-i18n';
  import { Doc, set } from 'sveltefirets';
  import { Button, Form } from 'svelte-pieces';
  import type { ICitation, IDictionary } from '@living-dictionaries/types';
  
  export let dictionary: IDictionary;
  export let isManager = false;

  let citationType: ICitation = { citation: '' };
  let value = '';
</script>

<Doc
  path={`dictionaries/${dictionary.id}/info/citation`}
  startWith={citationType}
  let:data={citation}
  on:data={(e) => (value = e.detail.data?.citation)}
  let:ref>
  {#if isManager}
    <Form
      let:loading
      onsubmit={async () => {
        try {
          await set(ref, { citation: value.trim() });
        } catch (err) {
          alert(err);
        }
      }}>
      <label for="names" class="block text-sm font-medium leading-5 text-gray-700 mt-4">
        {$t('contributors.how_to_cite_instructions', { default: 'Add the authors of this dictionary to show their names in the citation' })}
      </label>
      <div class="mt-1 rounded-md shadow-sm">
        <input
          dir="ltr"
          id="names"
          placeholder="Anderson, Gregory D. S."
          type="text"
          class="form-input block w-full"
          value={citation?.citation}
          on:change={(e) => {
            // @ts-ignore
            value = e.target.value.trim();
          }} />
      </div>
      <Button class="my-1" {loading} type="submit">
        {$t('misc.save', { default: 'Save' })}
      </Button>
    </Form>
  {/if}

  <div dir="ltr">
    {citation?.citation ? citation.citation + ' ' : ''}
    {new Date().getFullYear()}.
    <span>{$t('dictionary.full_title', { values: { dictionary_name: dictionary.name }})}</span>
    Living Tongues Institute for Endangered Languages. https://livingdictionaries.app/{dictionary.id}
  </div>
</Doc>
