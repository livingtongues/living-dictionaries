<script lang="ts">
  import PlayVideo from './PlayVideo.svelte';
  import { Story } from 'kitbook';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
</script>

# Video

<Story>
  <ShowHide let:show let:toggle>
    <Button onclick={toggle}>Open Video</Button>
    {#if show}
      <PlayVideo
        entry={{ lx: 'Hallibut', gl: {} }}
        video={null}
        storageBucket={'change'}
        canEdit
        on:close={toggle}
        on:delete={() => alert('delete clicked')} />
    {/if}
  </ShowHide>
</Story>

Needs sample video data added before any video will show up.