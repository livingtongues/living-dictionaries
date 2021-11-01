<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  let progress = tweened(0, {
    duration: 2000,
    easing: cubicOut,
  });
  $: percentage = Math.floor($progress * 100);
</script>

<div class="relative pt-1">
  <div class="flex mb-2 items-center justify-between">
    <div>
      <span
        class="text-xs font-semibold inline-block py-1 px-2 uppercase
        rounded-full text-blue-600 bg-blue-200">
        <!-- {$_('upload.uploading', { default: 'Uploading' })} -->
        Downloading
      </span>
    </div>
    <div class="text-right">
      <span class="text-xs font-semibold inline-block text-blue-600">
        {percentage}%
      </span>
    </div>
  </div>
  <div class="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
    <div
      style="width:{percentage}%"
      class="shadow-none flex flex-col text-center whitespace-nowrap
      text-white justify-center bg-blue-500" />
  </div>
</div>
