<script lang="ts">
  import { Button, Form } from '$lib/svelte-pieces'
  import { page } from '$app/stores'

  interface Props {
    id: string
    display: string
    value: string
    minlength?: number
    maxlength?: number
    required?: boolean
    save: (value: string) => Promise<void>
  }

  let {
    id,
    display,
    value = $bindable(),
    minlength = 0,
    maxlength = 30,
    required = false,
    save,
  }: Props = $props()
</script>

<Form onsubmit={async () => await save(value.trim())}>
  {#snippet children({ loading })}
    <label for={id}>
      {display}
    </label>
    <div class="input-row">
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
        class="form-input"
        placeholder={display} />
      <div style="width: 0.25rem"></div>
      <Button class="save-button" {loading} type="submit">
        {$page.data.t('misc.save')}
      </Button>
    </div>
  {/snippet}
</Form>

<style>
  label {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
    margin-bottom: 0.5rem;
  }

  .input-row {
    display: flex;
  }

  .input-row .form-input {
    width: 100%;
  }

  .input-row :global(.save-button) {
    flex-shrink: 0;
  }
</style>
