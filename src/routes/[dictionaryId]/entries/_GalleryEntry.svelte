<script lang="ts">
  import type { IEntry } from '$lib/interfaces';
  import Image from '$lib/components/image/Image.svelte';
  export let entry: IEntry;
  export let canEdit = false;
</script>

<div class="flex flex-col relative rounded" style="max-width: 500px; max-height: 500px;">
  <div class="bg-gray-300 shadow">
    <div class="aspect-square overflow-hidden">
      <Image square={480} {entry} {canEdit} />
    </div>
    <div class="card-content-wrapper">
      <p class="font-semibold absolute top-0 left-0">
        {@html entry._highlightResult ? entry._highlightResult.lx.value : entry.lx}
      </p>
      <p class="absolute bottom-0 left-0 text-xs">
        {@html entry._highlightResult
          ? entry._highlightResult.gl.en.value
          : entry.gl && entry.gl.en
          ? entry.gl.en
          : ''}
      </p>
    </div>
  </div>
</div>

<style>
  .card-content-wrapper {
    background: #f3f3f3;
    padding: 20px 20px 20px 10px;
  }

  .card-content-wrapper > p {
    position: relative;
  }
</style>
