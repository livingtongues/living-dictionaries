<script lang="ts">
  import { page } from '$app/stores';
  import { Doc, set, getCollection } from 'sveltefirets';
  import { Button, Form } from 'svelte-pieces';
  import type { ICitation, IDictionary, IPartnership } from '@living-dictionaries/types';
  import { browser } from '$app/environment';

  export let dictionary: IDictionary;
  export let isManager = false;

  const citationType: ICitation = { citation: '' };
  let partners: IPartnership[];
  let value = '';

  $: if (browser) {
    getCollection<IPartnership>(`dictionaries/${dictionary.id}/partnerships`).then(
      (partnerships) => (partners = partnerships)
    );
  }
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
        {$page.data.t('contributors.how_to_cite_instructions')}
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
        {$page.data.t('misc.save')}
      </Button>
    </Form>
  {/if}

  <div dir="ltr">
    {citation?.citation ? citation.citation + ' ' : ''}
    {new Date().getFullYear()}.
    <span>{$page.data.t('dictionary.full_title', { values: { dictionary_name: dictionary.name }})}.</span>
    Living Tongues Institute for Endangered Languages{partners ? ', ' + partners.map(partner => partner.name).join(', ') : ''}. https://livingdictionaries.app/{dictionary.id}
  </div>
</Doc>
