<script lang="ts">
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import Form from '$lib/components/ui/Form.svelte'
  import { page } from '$app/state'

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
        placeholder={display} />
      <div style="width: 0.25rem"></div>
      <HeadlessButton class="btn btn-default save-button" {loading} type="submit">
        {page.data.t('misc.save')}
      </HeadlessButton>
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

  .input-row input {
    width: 100%;
  }

  .input-row :global(.save-button) {
    flex-shrink: 0;
  }
</style>
