<script>
  import EntryPartOfSpeech from './EntryPartOfSpeech.svelte';
  import { Story } from 'kitbook';
</script>

<Story name="cannot edit">
  <EntryPartOfSpeech value={['n', 'pro']} />
</Story>

<Story>
  <EntryPartOfSpeech canEdit value={['n', 'pro']} on:valueupdate={(e) => console.log(e.detail)} />
</Story>

<Story name="string">
  <EntryPartOfSpeech value="foo" />
</Story>

<Story name="undefined, can edit">
  <EntryPartOfSpeech canEdit value={undefined} />
</Story>
