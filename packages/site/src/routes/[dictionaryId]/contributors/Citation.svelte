<script lang="ts">
  import { Button, Form } from 'svelte-pieces'
  import type { Citation, IDictionary, Partner } from '@living-dictionaries/types'
  import { build_citation } from './build-citation'
  import { page } from '$app/stores'

  export let dictionary: IDictionary
  export let isManager = false
  export let partners: Partner[]
  export let citation: Citation
  export let update_citation: (citation: string) => Promise<void>

  let value = ''
</script>

{#if isManager}
  <Form
    let:loading
    onsubmit={async () => {
      try {
        await update_citation(value.trim())
      } catch (err) {
        alert(err)
      }
    }}>
    <label for="names" class="block text-sm font-medium leading-5 text-gray-700 mt-4">
      {$page.data.t('contributors.how_to_cite_instructions')}
    </label>
    <div class="mt-1 rounded-md shadow-sm">
      <input
        dir="ltr"
        id="names"
        placeholder="Anderson, Gregory D. S."
        type="text"
        class="form-input block w-full"
        value={citation?.citation}
        on:change={(e) => {
          // @ts-expect-error
          value = e.target.value.trim()
        }} />
    </div>
    <Button class="my-1" {loading} type="submit">
      {$page.data.t('misc.save')}
    </Button>
  </Form>
{/if}

<div dir="ltr">
  {build_citation({ t: $page.data.t, dictionary, custom_citation: citation?.citation, partners })}
</div>
