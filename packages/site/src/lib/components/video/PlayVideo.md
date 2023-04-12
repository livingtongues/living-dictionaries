<script lang="ts">
  import PlayVideo from './PlayVideo.svelte';
  import { Story } from 'kitbook';
  import { Button, ShowHide } from 'svelte-pieces';
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
        on:deleteVideo={() => alert('delete clicked')} />
    {/if}
  </ShowHide>
</Story>

Needs sample video data added before any video will show up.