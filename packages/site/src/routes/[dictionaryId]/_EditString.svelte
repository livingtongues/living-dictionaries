<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import Form from 'svelte-pieces/data/Form.svelte';

  export let id: 'name' | 'iso6393' | 'glottocode';
  export let display: string;
  export let value: string;
  export let minlength = 0;
  export let maxlength = 30;
  export let required = false;

  export let save: (value: string) => Promise<void>;
</script>

<Form let:loading onsubmit={async () => save(value.trim())}>
  <label for={id} class="text-sm font-medium text-gray-700 mb-2">
    {display}
  </label>
  <div class="flex">
    <input
      {id}
      type="text"
      autocomplete="off"
      autocorrect="off"
      spellcheck={false}
      {minlength}
      {maxlength}
      {required}
      bind:value
      class="form-input w-full"
      placeholder={`Enter ${id}`} />
    <div class="w-1" />
    <Button {loading} type="submit">
      {$_('misc.save', { default: 'Save' })}
    </Button>
  </div>
</Form>
