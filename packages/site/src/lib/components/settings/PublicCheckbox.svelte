<script lang="ts">
  import { page } from '$app/state'

  interface Props {
    checked: boolean;
    on_changed?: (payload: { checked: boolean }) => void;
  }

  let { checked, on_changed }: Props = $props();
</script>

<div class="flex items-center">
  <input
    id="public"
    type="checkbox"
    {checked}
    onchange={(e: Event & { currentTarget: HTMLInputElement }) => {
      on_changed?.({ checked: e.currentTarget.checked })
    }} />
  <label for="public" class="mx-2 block text-sm font-medium text-gray-700">
    {page.data.t('create.visible_to_public')}
  </label>
</div>
<div class="text-xs text-gray-600 mt-1">
  ({page.data.t('settings.public_private_meaning')})
</div>
