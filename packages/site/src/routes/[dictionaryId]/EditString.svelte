<script lang="ts">
  import { Button, Form } from 'svelte-pieces'
  import { page } from '$app/stores'


  interface Props {
    id: string;
    display: string;
    value: string;
    minlength?: number;
    maxlength?: number;
    required?: boolean;
    save: (value: string) => Promise<void>;
  }

  let {
    id,
    display,
    value = $bindable(),
    minlength = 0,
    maxlength = 30,
    required = false,
    save
  }: Props = $props();
</script>

<Form  onsubmit={async () => await save(value.trim())}>
  {#snippet children({ loading })}
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
      <div class="w-1"></div>
      <Button class="shrink-0" {loading} type="submit">
        {$page.data.t('misc.save')}
      </Button>
    </div>
  {/snippet}
</Form>
