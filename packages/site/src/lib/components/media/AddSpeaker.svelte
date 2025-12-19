<script lang="ts">
  import { Button, Form, Modal } from '$lib/svelte-pieces'
  import type { Tables } from '@living-dictionaries/types'
  import { decades } from './ages'
  import { page } from '$app/state'

  interface Props {
    on_close: () => void;
    on_speaker_added: (speaker_id: string) => void;
  }

  let { on_close, on_speaker_added }: Props = $props();
  let { dbOperations } = $derived(page.data)

  let displayName = $state('')
  let birthplace = $state('')
  let decade = $state(4)
  let gender: Tables<'speakers'>['gender'] = $state('m')
  let agreeToBeOnline = $state(true)
</script>

<Modal {on_close}>
  {#snippet heading()}
    <span >{page.data.t('speakers.add_new_speaker')}
    </span>
  {/snippet}

  <Form
    
    onsubmit={async () => {
      const speaker = await dbOperations.insert_speaker({
        name: displayName.trim(),
        birthplace: birthplace.trim(),
        decade,
        gender,
      })
      on_speaker_added(speaker.id)
    }}>
    {#snippet children({ loading })}
        <label for="name" class="block text-sm font-medium leading-5 text-gray-700 mt-4">
        {page.data.t('speakers.name')}
      </label>
      <div class="mt-1 rounded-md shadow-sm">
        <input
          id="name"
          type="text"
          required
          bind:value={displayName}
          class="form-input block w-full" />
      </div>

      <label for="birthplace" class="block text-sm font-medium leading-5 text-gray-700 mt-4">
        {page.data.t('speakers.birthplace')}
      </label>
      <div class="mt-1 rounded-md shadow-sm">
        <input
          id="birthplace"
          type="text"
          required
          bind:value={birthplace}
          class="form-input block w-full" />
      </div>

      <label for="age" class="block text-sm font-medium leading-5 text-gray-700 mt-4">
        {page.data.t('speakers.age_range')}
      </label>
      <div class="mt-1 rounded-md shadow-sm">
        <select id="age" bind:value={decade} class="form-input block w-full">
          {#each Object.entries(decades) as [value, label] (value)}
            <option {value}>{label}</option>
          {/each}
        </select>
      </div>

      <div class="font-medium text-sm text-gray-700 mt-4">
        {page.data.t('speakers.gender')}
      </div>
      <div class="flex">
        <div class="mt-2 flex items-center">
          <input id="male" type="radio" bind:group={gender} value="m" />
          <div class="w-2"></div>
          <label for="male">
            <span class="block text-sm leading-5 font-medium text-gray-700">
              {page.data.t('speakers.male')}
            </span>
          </label>
        </div>
        <div class="w-3"></div>
        <div class="mt-2 flex items-center">
          <input id="female" type="radio" bind:group={gender} value="f" />
          <div class="w-2"></div>
          <label for="female">
            <span class="block text-sm leading-5 font-medium text-gray-700">
              {page.data.t('speakers.female')}
            </span>
          </label>
        </div>
        <div class="w-3"></div>
        <div class="mt-2 flex items-center">
          <input id="other" type="radio" bind:group={gender} value="o" />
          <div class="w-2"></div>
          <label for="other">
            <span class="block text-sm leading-5 font-medium text-gray-700">
              {page.data.t('speakers.other')}
            </span>
          </label>
        </div>
      </div>

      <div class="flex items-center mt-6">
        <input id="agree" type="checkbox" required bind:checked={agreeToBeOnline} />
        <div class="w-2"></div>
        <label for="agree" class="block text-sm leading-5 text-gray-900">
          {page.data.t('speakers.speaker_agrees')}
        </label>
      </div>

      <!-- TODO: "The speaker is me" checkbox -->

      <div class="modal-footer space-x-1">
        <Button disabled={loading} onclick={on_close} form="simple" color="black">
          {page.data.t('misc.cancel')}
        </Button>
        <Button type="submit" form="filled" {loading}>
          {page.data.t('misc.save')}
        </Button>
      </div>
          {/snippet}
    </Form>
</Modal>
