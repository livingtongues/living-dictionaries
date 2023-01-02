<script lang="ts">
  import { Story } from 'kitbook';
  import EditableGlossesField from './EditableGlossesField.svelte';
  import { glossingLanguages } from '@living-dictionaries/parts/src/lib/glosses/glossing-languages';
  import ReactiveSet from 'svelte-pieces/functions/ReactiveSet.svelte';
  let selectedLanguages = ['en', 'de', 'fr'];
  let admin = true;
</script>

<!-- prettier-ignore -->
# Edit Gloss Languages

There must always be at least one glossing language (or however many the
`minimum` prop is set to) for the remove "x" buttons to show.

<Story knobs={{ minimum: 1 }} let:props={{ minimum }}>
  <EditableGlossesField
    {minimum}
    {selectedLanguages}
    availableLanguages={glossingLanguages}
    on:add={(e) => (selectedLanguages = [...selectedLanguages, e.detail.languageId])}
    on:remove={(e) => {
      selectedLanguages.splice(e.detail.index, 1);
      selectedLanguages = selectedLanguages;
    }} />
</Story>

<Story name="Minimum reached">
  <EditableGlossesField selectedLanguages={['en']} availableLanguages={glossingLanguages} />
</Story>

In contexts like the settings page, we only want admins to be able to remove, for all others we can
display a message asking to Contact Us. Toggle the admin status and remove languages to test.

<Story name="Only Admin Can Remove">
  <label class="block my-1">
    <span class="inline-block mr-2 text-sm font-semibold">Admin</span>
    <input type="checkbox" bind:checked={admin} />
  </label>
  <ReactiveSet input={['en', 'he']} let:value={scopedLanguages} let:add let:remove>
    <EditableGlossesField
      selectedLanguages={scopedLanguages}
      availableLanguages={glossingLanguages}
      on:add={(e) => add(e.detail.languageId)}
      on:remove={(e) => {
        console.log(admin);
        if (admin) {
          if (
            confirm('Remove as admin? Know that regular editors get a message saying "Contact Us"')
          ) {
            remove(e.detail.languageId);
          }
        } else {
          alert('Contact Us');
          // in page use: alert(t ? $t('header.contact_us') : 'Contact Us');
        }
      }} />
  </ReactiveSet>
</Story>

<Story name="No languages">
  <EditableGlossesField
    selectedLanguages={[]}
    availableLanguages={glossingLanguages}
    on:add={(e) => alert(`Add a new Id: ${e.detail.languageId}`)} />
</Story>
