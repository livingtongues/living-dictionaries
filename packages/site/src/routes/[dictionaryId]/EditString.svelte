<script lang="ts">
  import { Button, Form } from 'svelte-pieces'
  import { page } from '$app/stores'

  export let id: string
  export let display: string
  export let value: string
  export let minlength = 0
  export let maxlength = 30
  export let required = false

  export let save: (value: string) => Promise<void>
</script>

<Form let:loading onsubmit={async () => await save(value.trim())}>
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
    <Button class="shrink-0" {loading} type="submit">
      {$page.data.t('misc.save')}
    </Button>
  </div>
</Form>
