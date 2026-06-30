<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { page } from '$app/state'

  interface Props {
    checked: boolean
  }

  const { checked }: Props = $props()

  const dispatch = createEventDispatcher<{ changed: { checked: boolean } }>()
</script>

<div style="display: flex; align-items: center">
  <input
    id="public"
    type="checkbox"
    {checked}
    onchange={(e) => {
      // @ts-ignore
      dispatch('changed', { checked: e.target.checked })
    }} />
  <label for="public" class="checkbox-label">
    {page.data.t('create.visible_to_public')}
  </label>
</div>
<div class="hint">
  ({page.data.t('settings.public_private_meaning')})
</div>

<style>
  .checkbox-label {
    margin-left: 0.5rem;
    margin-right: 0.5rem;
    display: block;
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
  }

  .hint {
    font-size: 0.75rem;
    line-height: 1rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    margin-top: 0.25rem;
  }
</style>
