<script lang="ts">
  import IconDownload from '~icons/fa-solid/download'
  import IconTrashAlt from '~icons/fa-regular/trash-alt'
  import { apply_button_label } from './image-store'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import { page } from '$app/state'
  import AddImage from '$lib/components/image/AddImage.svelte'
  import { add_photo } from '$lib/media/add-media'

  interface Props {
    on_close: () => void
    sense_id: string
  }

  const { on_close, sense_id }: Props = $props()
  let photo_source: string = $state()
  let photographer: string = $state()
  let rights = $state(false)
  let ai_image = $state(false)

  function handle_image_upload(file: File) {
    const handle = add_photo({
      writes: page.data.writes,
      dictionary_id: page.data.dictionary.id,
      sense_id,
      file,
      source: photo_source,
      photographer,
    })
    handle.done.then(on_close).catch(() => undefined) // error renders in the upload tile
    return handle
  }

  $effect(() => {
    if (ai_image) {
      photographer = 'AI'
    } else {
      photographer = ''
    }
  })

  $effect(() => {
    if (photo_source?.length >= 10 && rights) {
      apply_button_label.set({ ready_to_upload: true })
    } else {
      apply_button_label.set({ ready_to_upload: false })
    }
  })
</script>

<Modal on_close={on_close}>
  <label class="field-label" for="photo_source">
    {page.data.t('entry.source', { values: { media: page.data.t('entry_field.photo') } })} <i class="hint-text">{page.data.t('entry.source_message', { values: { media: page.data.t('entry.this_image') } })}</i> (<span class="required-text">{page.data.t('misc.required')}</span>)
  </label>
  <textarea
    name="photo_source"
    required
    rows="4"
    minlength="100"
    maxlength="2500"
    bind:value={photo_source}
    class="full-width"></textarea>
  <div class="counter-row">
    <div class="counter">{photo_source?.length || 0}/2500</div>
  </div>
  <div>
    <input bind:checked={rights} type="checkbox" id="rigths" name="rigths" required />
    <label for="rigths">{page.data.t('entry.rights', { values: { media: page.data.t('entry.this_image') } })} (<span class="required-text" style="font-weight: 500">{page.data.t('misc.required')}</span>)</label>
  </div>
  <div>
    <input bind:checked={ai_image} type="checkbox" id="ai_image" name="ai_image" />
    <label for="ai_image">{page.data.t('entry.AI_generated', { values: { media: page.data.t('entry.this_image') } })}</label>
  </div>
  {#if !ai_image}
    <label class="field-label" style="margin-top: 0.75rem" for="photographer">
      {page.data.t('image.photographer')} ({page.data.t('misc.optional')})
    </label>
    <textarea
      name="photographer"
      rows="1"
      minlength="0"
      maxlength="2500"
      bind:value={photographer}
      class="full-width"></textarea>
  {/if}

  <div style="margin-bottom: 1.5rem"></div>

  <AddImage upload_image={handle_image_upload} require_entry_fields>
    <div style="font-size: 0.75rem; line-height: 1rem">
      {page.data.t('entry_field.photo')}
    </div>
  </AddImage>

  <div class="modal-footer">
    <HeadlessButton class="btn btn-default" onclick={on_close}>
      {page.data.t('misc.close')}
    </HeadlessButton>
  </div>
</Modal>

<style>
  .field-label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
  }

  .hint-text {
    color: var(--color-secondary); /* ≈ gray-500 */
  }

  .required-text {
    color: rgb(239 68 68); /* red-500 */
  }

  .full-width {
    width: 100%;
  }

  .counter-row {
    display: flex;
    font-size: 0.75rem;
    line-height: 1rem;
  }

  .counter {
    color: var(--color-secondary); /* ≈ gray-500 */
    margin-left: auto;
  }
</style>
