<script lang="ts">
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import Form from '$lib/components/ui/Form.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import { page } from '$app/state'

  interface Props {
    display: string
    value: string | null
    minlength?: number
    maxlength?: number
    required?: boolean
    save: (value: string) => Promise<void>
    on_close: () => void
  }

  const { display, value, minlength = 0, maxlength = 100, required = false, save, on_close }: Props = $props()
  let draft = $state(value ?? '')
</script>

<Modal {on_close}>
  {#snippet heading()}
    <span>{display}</span>
  {/snippet}
  <Form
    onsubmit={async () => {
      await save(draft.trim())
      on_close()
    }}>
    {#snippet children({ loading })}
      <div class="input-row">
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          autofocus
          autocomplete="off"
          autocorrect="off"
          spellcheck={false}
          {minlength}
          {maxlength}
          {required}
          bind:value={draft}
          placeholder={display} />
        <HeadlessButton class="btn btn-default" {loading} type="submit">
          {page.data.t('misc.save')}
        </HeadlessButton>
      </div>
    {/snippet}
  </Form>
</Modal>

<style>
  .input-row {
    display: flex;
    gap: 0.375rem;
  }

  .input-row input {
    flex-grow: 1;
    min-width: 0;
  }
</style>
