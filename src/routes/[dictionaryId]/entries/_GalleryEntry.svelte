<script lang="ts">
  import type { IEntry } from '$lib/interfaces';
  import Image from '$lib/components/image/Image.svelte';
  export let entry: IEntry;
  export let canEdit = false;
</script>

<div
  class="bg-gray-300 shadow relative rounded overflow-hidden"
  style="max-width: 500px; max-height: 500px;">
  <Image square={480} {entry} {canEdit} />
  <div
    class="text-dark-shadow text-white font-semibold p-2 absolute top-0
            left-0">
    {@html entry._highlightResult ? entry._highlightResult.lx.value : entry.lx}
  </div>
  <div
    class="text-dark-shadow text-white p-2 absolute bottom-0 left-0
            text-xs">
    {@html entry._highlightResult
      ? entry._highlightResult.gl.en.value
      : entry.gl && entry.gl.en
      ? entry.gl.en
      : ''}
  </div>
</div>
