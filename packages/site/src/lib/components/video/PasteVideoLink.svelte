<script lang="ts">
  import { t } from 'svelte-i18n';
  import { Button } from 'svelte-pieces';
  import { parseVideoData } from './parseVideoData';
  import { createEventDispatcher } from 'svelte';
  import type { GoalDatabaseVideo } from '@living-dictionaries/types';
  const dispatch = createEventDispatcher<{ update: GoalDatabaseVideo }>();

  let url: string;

  function handle() {
    const video = parseVideoData(url);
    if (!video) {
      alert($t('misc.invalid_url', { default: 'This is not a valid URL' }));
      url = '';
      return;
    }
    dispatch('update', video);
  }
</script>

<form class="mb-4" on:submit|preventDefault={handle}>
  <label for="vURL" class="block text-sm font-medium leading-5 text-gray-700 mb-2">
    <i class="far fa-link" />
    {$t('video.video_url', { default: 'Video URL' })}
  </label>
  <div class="flex">
    <div class="rounded-md shadow-sm flex-grow">
      <input
        id="vURL"
        type="url"
        placeholder="Paste YouTube or Vimeo link"
        required
        bind:value={url}
        class="form-input block w-full" />
    </div>
    <div class="w-1" />
    <Button type="submit" form={url ? 'filled' : 'outline'}>
      {$t('misc.add', { default: 'Add' })}
    </Button>
  </div>
  <!-- {$t('video.video_credit', { default: 'Video credit' })} -->
</form>
