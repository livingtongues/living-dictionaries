<script lang="ts">
  import { _ } from 'svelte-i18n';

  /* export let value = '',
    canEdit = false; */

  /* $: writeInPOS = value && !partsOfSpeech.find((part) => part.enAbbrev === value); */
</script>

<!-- svelte-ignore a11y-no-onchange -->
<!-- <select class="h-full p-0 border-none" on:change={onChange} bind:value>
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
</select> -->

