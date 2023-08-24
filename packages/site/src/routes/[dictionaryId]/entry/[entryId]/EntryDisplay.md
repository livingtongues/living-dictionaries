<script lang="ts">
  import { Story } from 'kitbook';
  import EntryDisplay from './EntryDisplay.svelte';
  import { variants } from './EntryDisplay.variants';
</script>

<!-- on:deleteImage={() => deleteImage(entry, $dictionary.id)}
on:deleteVideo={() => deleteVideo(entry, $dictionary.id)} -->
<Story
  knobs={{ canEdit: true }}
  let:props={{ canEdit }}>
  <EntryDisplay entry={variants[0].props.entry} dictionary={variants[0].props.dictionary} {canEdit} on:valueupdate={({detail}) => console.log(detail)}></EntryDisplay>
</Story>
