<script lang="ts">
  import Image from './Image.svelte';
  import Image2 from './Image2.svelte';
  import { Story } from 'kitbook';
</script>

# Image

<Story
  knobs={{ canEdit: true, width: '40-400;80', height: '40-400;80' }}
  let:props={{ canEdit, width, height }}>
  <div style="width: {width}px; height: {height}px">
    <Image
      lexeme="butterfly"
      gcs="LGuBKhg7vuv5-aJcOdnb_ucOXLSCIR1Kjxrh70xRlaIHqWo-mWqfWUcH3Xznz63QsFZmkeVmoNN0PEXzSc0Jh4g"
      width={+width}
      height={+height}
      {canEdit}
      on:delete={() => alert('delete clicked')} />
  </div>
</Story>

- note how the thumbnail size is calculated from the width and doesn't take into consideration both
width and height

<Story
  name="New Image method - WIP"
  knobs={{ canEdit: true, length: '40-400;80' }}
  let:props={{ canEdit, length }}>
  <div style="width: {length}px; height: {length}px">
    <Image2
      length={+length}
      gcs="LGuBKhg7vuv5-aJcOdnb_ucOXLSCIR1Kjxrh70xRlaIHqWo-mWqfWUcH3Xznz63QsFZmkeVmoNN0PEXzSc0Jh4g" />
  </div>
</Story>