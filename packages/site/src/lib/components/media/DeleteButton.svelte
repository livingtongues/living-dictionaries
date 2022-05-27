<script lang="ts">
  import { _ } from 'svelte-i18n';
  export let action = () => {}
</script>

<div
  class="font-semibold text-white py-2 px-1 flex justify-end">
  <button
    type="button"
    on:click|stopPropagation={action}
    class="px-3 py-2 rounded bg-red-500 transition-all hover:bg-red-600 transform hover:scale-105">
    <i class="far fa-trash-alt" />
    {$_('misc.delete', { default: 'Delete' })}
  </button>
</div>