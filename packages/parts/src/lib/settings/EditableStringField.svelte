<script lang="ts">
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;

  import Button from 'svelte-pieces/ui/Button.svelte';

  export let value: string;

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    update: { value: string };
  }>();
</script>