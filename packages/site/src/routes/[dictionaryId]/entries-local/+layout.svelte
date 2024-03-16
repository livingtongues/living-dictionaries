<script lang="ts">
  import { JSON } from 'svelte-pieces';

  export let data;
  $: ({entries} = data)
</script>

<div class="p-2 mb-3 rounded bg-gray-200">
  Search
  <JSON obj={$entries} />
</div>

<slot />
