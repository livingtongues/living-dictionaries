<script lang="ts">
  import { t } from 'svelte-i18n';
  import { Button, Form } from 'svelte-pieces';

  export let id: string;
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
      placeholder={display} />
    <div class="w-1" />
    <Button class="flex-shrink-0" {loading} type="submit">
      {$t('misc.save', { default: 'Save' })}
    </Button>
  </div>
</Form>
