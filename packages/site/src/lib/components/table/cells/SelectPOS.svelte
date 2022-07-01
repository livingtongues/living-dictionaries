<script lang="ts">
  import { _ } from 'svelte-i18n';

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  export let value = '',
    canEdit = false;

  import { partsOfSpeech } from '@ld/parts';

  $: writeInPOS = value && !partsOfSpeech.find((part) => part.enAbbrev === value);

  function onChange(event) {
    dispatch('valueupdate', {
      field: 'ps',
      newValue: event.target.value,
    });
  }
</script>

<!-- svelte-ignore a11y-no-onchange -->
<select class="h-full p-0 border-none" on:change={onChange} bind:value>
  <option />

  {#if writeInPOS}
    <optgroup label="Custom">
      <option {value}>{value}</option>
    </optgroup>
  {/if}

  {#each partsOfSpeech as part}
    <option disabled={part.unofficial || !canEdit} value={part.enAbbrev}>
      {#if part.unofficial}
        {part.enName}
      {:else}
        {$_('ps.' + part.enAbbrev, { default: part.enName })}
      {/if}
    </option>
  {/each}
</select>

<style>
  select {
    appearance: auto;
    background: transparent;
    width: 100%;
  }
</style>
