<script lang="ts">
  import type { Tables } from '$lib/types'
  import { decades } from './ages'
  import Button from '$lib/components/ui/Button.svelte'
  import Form from '$lib/components/ui/Form.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import { page } from '$app/state'

  interface Props {
    on_close: () => void
    on_speaker_added: (speaker_id: string) => void
  }

  const { on_close, on_speaker_added }: Props = $props()
  const { db_operations } = $derived(page.data)

  let displayName = $state('')
  let birthplace = $state('')
  let decade = $state(4)
  let gender: Tables<'speakers'>['gender'] = $state('m')
  let agreeToBeOnline = $state(true)
</script>

<Modal on_close={on_close}>
  {#snippet heading()}
    <span>{page.data.t('speakers.add_new_speaker')}
    </span>
  {/snippet}

  <Form

    onsubmit={async () => {
      const speaker = await db_operations.insert_speaker({
        name: displayName.trim(),
        birthplace: birthplace.trim(),
        decade,
        gender,
      })
      on_speaker_added(speaker.id)
    }}>
    {#snippet children({ loading })}
      <label for="name" class="field-label">
        {page.data.t('speakers.name')}
      </label>
      <div class="input-wrap">
        <input
          id="name"
          type="text"
          required
          bind:value={displayName}
          class="full-input" />
      </div>

      <label for="birthplace" class="field-label">
        {page.data.t('speakers.birthplace')}
      </label>
      <div class="input-wrap">
        <input
          id="birthplace"
          type="text"
          required
          bind:value={birthplace}
          class="full-input" />
      </div>

      <label for="age" class="field-label">
        {page.data.t('speakers.age_range')}
      </label>
      <div class="input-wrap">
        <select id="age" bind:value={decade} class="full-input">
          {#each Object.entries(decades) as [value, label] (value)}
            <option {value}>{label}</option>
          {/each}
        </select>
      </div>

      <div class="field-label">
        {page.data.t('speakers.gender')}
      </div>
      <div style="display: flex">
        <div class="radio-row">
          <input id="male" type="radio" bind:group={gender} value="m" />
          <div style="width: 0.5rem"></div>
          <label for="male">
            <span class="radio-label">
              {page.data.t('speakers.male')}
            </span>
          </label>
        </div>
        <div style="width: 0.75rem"></div>
        <div class="radio-row">
          <input id="female" type="radio" bind:group={gender} value="f" />
          <div style="width: 0.5rem"></div>
          <label for="female">
            <span class="radio-label">
              {page.data.t('speakers.female')}
            </span>
          </label>
        </div>
        <div style="width: 0.75rem"></div>
        <div class="radio-row">
          <input id="other" type="radio" bind:group={gender} value="o" />
          <div style="width: 0.5rem"></div>
          <label for="other">
            <span class="radio-label">
              {page.data.t('speakers.other')}
            </span>
          </label>
        </div>
      </div>

      <div class="agree-row">
        <input id="agree" type="checkbox" required bind:checked={agreeToBeOnline} />
        <div style="width: 0.5rem"></div>
        <label for="agree" class="agree-label">
          {page.data.t('speakers.speaker_agrees')}
        </label>
      </div>

      <!-- TODO: "The speaker is me" checkbox -->

      <div class="modal-footer">
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

<style>
  .field-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.25rem;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
    margin-top: 1rem;
  }

  .input-wrap {
    margin-top: 0.25rem;
    border-radius: 0.375rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); /* shadow-sm */
  }

  .input-wrap :global(.full-input) {
    display: block;
    width: 100%;
  }

  .radio-row {
    margin-top: 0.5rem;
    display: flex;
    align-items: center;
  }

  .radio-label {
    display: block;
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
  }

  .agree-row {
    display: flex;
    align-items: center;
    margin-top: 1.5rem;
  }

  .agree-label {
    display: block;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--color); /* ≈ gray-900 */
  }
</style>
