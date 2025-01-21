<script lang="ts">
  import { Button, Form } from 'svelte-pieces'
  import type { Citation, Partner, Tables } from '@living-dictionaries/types'
  import { build_citation } from './build-citation'
  import { page } from '$app/stores'

  export let dictionary: Tables<'dictionaries'>
  export let isManager = false
  export let partners: Partner[]
  export let citation: Citation
  export let update_citation: (citation: string) => Promise<void>

  let value = ''
  let unsaved = false
</script>

{#if isManager}
  <Form
    let:loading
    onsubmit={async () => {
      try {
        await update_citation(value.trim())
        unsaved = false
      } catch (err) {
        alert(err)
      }
    }}>
    <label for="names" class="block text-sm font-medium leading-5 text-gray-700 mt-4">
      {$page.data.t('contributors.how_to_cite_instructions')}
    </label>
    <div class="mt-1 flex">
      <input
        dir="ltr"
        id="names"
        placeholder="Anderson, Gregory D. S."
        type="text"
        class="form-input w-full"
        value={citation?.citation || ''}
        on:input={(e) => {
          // @ts-expect-error
          value = e.target.value.trim()
          unsaved = value !== citation?.citation
        }} />
      <div class="w-1" />
      <Button class="shrink-0" {loading} type="submit">
        {$page.data.t('misc.save')}
      </Button>
    </div>
  </Form>
{/if}

<div dir="ltr" class:text-orange={unsaved}>
  {build_citation({ t: $page.data.t, dictionary, custom_citation: value || citation?.citation, partners })}
</div>
