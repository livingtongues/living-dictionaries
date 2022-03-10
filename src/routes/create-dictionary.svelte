<script lang="ts">
  import { _ } from 'svelte-i18n';
  import BadgeArray from '$svelteui/data/BadgeArray.svelte';
  import MultiSelect from '$lib/components/ui/MultiSelect.svelte';
  import EditString from '$lib/components/home/EditString.svelte';
  import EditCoordinates from '$lib/components/home/EditCoordinates.svelte';
  import { glossingLanguages } from '$lib/mappings/glossing-languages';
  import { user } from '$lib/stores';
  import Header from '$lib/components/shell/Header.svelte';
  import Button from '$svelteui/ui/Button.svelte';
  import type { IDictionary, IHelper, IUser } from '$lib/interfaces';
  import { docExists, setOnline, updateOnline } from '$sveltefirets';
  import { arrayUnion, GeoPoint, serverTimestamp } from 'firebase/firestore/lite';
  import { debounce } from '$lib/helpers/debounce';
  import { pruneObject } from '$lib/helpers/prune';

  let modal: 'auth' = null;
  let submitting = false;

  let alternateNames = [];
  let glossLanguages = ['en'];
  let lat = 0;
  let lng = 0;
  let iso6393 = '';
  let glottocode = '';
  let publicDictionary = false;

  let name = '';
  $: url = name;

  let urlAlreadyExists = false;
  $: {
    url = url
      .trim()
      .slice(0, 25) // Max 25 characters
      .trim()
      .replace(/\s+/g, '-') // Replace string-medial spaces with hyphens
      .replace(/[';,!@#$%^&*()]/g, '') // Remove special characters
      .toLowerCase();
    urlAlreadyExists = false;
    if (url.length > 2) checkIfExists(url);
  }

  const checkIfExists = debounce((passedUrl) => {
    docExists(`dictionaries/${passedUrl}`).then((exists) => {
      urlAlreadyExists = exists;
    });
  }, 500);

  async function createNewDictionary() {
    if (!$user) {
      modal = 'auth';
      return;
    }
    if (await docExists(`dictionaries/${url}`)) {
      urlAlreadyExists = true;
      return alert(
        $_('create.choose_different_url', {
          default: 'Choose a different URL.',
        })
      );
    }
    if (glossLanguages.length === 0) {
      return alert(
        $_('create.at_least_one_lang', {
          default: 'Choose at least 1 language to make the dictionary available in.',
        })
      );
    }
    try {
      submitting = true;
      const dictionaryData: IDictionary = {
        name: name.trim().replace(/^./, name[0].toUpperCase()),
        glossLanguages,
        public: publicDictionary,
        alternateNames,
        coordinates: new GeoPoint(lat, lng),
        entryCount: 0,
        createdBy: $user.uid,
        iso6393: iso6393.trim(),
        glottocode: glottocode.trim(),
      };
      await setOnline<IDictionary>(`dictionaries/${url}`, pruneObject(dictionaryData));
      await setOnline<IHelper>(`dictionaries/${url}/managers/${$user.uid}`, {
        id: $user.uid,
        name: $user.displayName,
      });
      await updateOnline<IUser>(`users/${$user.uid}`, {
        managing: arrayUnion(url),
        // WARNING: If we are going to make a delete dictionary option available to users, we must delete the corresponding management data in the user interface
        termsAgreement: serverTimestamp(),
      });
      window.location.replace(`/${url}/entries/list`);
    } catch (err) {
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
    submitting = false;
  }

  let online = true;
</script>

<svelte:window bind:online />

<svelte:head>
  <title>
    {$_('create.create_new_dictionary', { default: 'Create New Dictionary' })}
  </title>
</svelte:head>

<Header
  >{$_('create.create_new_dictionary', {
    default: 'Create New Dictionary',
  })}</Header>

<form class="flex" on:submit|preventDefault={createNewDictionary}>
  <div class="flex flex-col justify-center p-4 max-w-md mx-auto">
    <div class="mt-6">
      <EditString
        bind:attribute={name}
        attributeType="name"
        creation
        display="{$_('dictionary.name_of_language', { default: 'Name of Language' })}*" />
      <div class="text-xs text-gray-600 mt-1">
        {$_('create.name_clarification', {
          default: 'This will be the name of the dictionary.',
        })}
      </div>
    </div>

    <div class="mt-6 opacity-10" class:opacity-10={name.length < 3}>
      <div class="flex justify-between items-center" style="direction: ltr">
        <label for="url" class="text-sm font-medium leading-5 text-gray-700"> URL </label>
      </div>

      <div class="mt-1 flex rounded-md shadow-sm" style="direction: ltr">
        <span
          class="inline-flex items-center px-2 rounded-l-md border border-r-0
            border-gray-300 bg-gray-50 text-gray-500 text-sm">
          livingdictionaries.app/
        </span>
        <input
          id="url"
          bind:value={url}
          required
          minlength="3"
          maxlength="25"
          autocomplete="off"
          autocorrect="off"
          spellcheck={false}
          class="form-input flex-1 block w-full px-2 sm:px-3 py-2 rounded-none
            rounded-r-md sm:text-sm sm:leading-5"
          placeholder="url" />
      </div>
      <div class="text-xs text-gray-600 mt-1">
        {$_('create.only_letters_numbers', {
          default: 'Only letters and numbers allowed (no spaces or special characters)',
        })}
      </div>
      {#if urlAlreadyExists}
        <div class="text-xs text-red-600 mt-1">
          {$_('create.choose_different_url', {
            default: 'Choose a different URL',
          })}
        </div>
      {/if}
    </div>

    <div class="mt-6">
      <label for="glosses" class="block text-sm font-medium leading-5 text-gray-700">
        {$_('create.gloss_dictionary_in', {
          default: 'Make dictionary available in...',
        })}*
      </label>

      <div class="mt-1 rounded-md shadow-sm" style="direction: ltr">
        <MultiSelect
          bind:value={glossLanguages}
          placeholder={$_('create.languages', { default: 'Language(s)' })}>
          {#each Object.keys(glossingLanguages) as bcp}
            <option value={bcp}>
              {glossingLanguages[bcp].vernacularName || $_('gl.' + bcp)}
              {#if glossingLanguages[bcp].vernacularAlternate}
                {glossingLanguages[bcp].vernacularAlternate}
              {/if}
              {#if glossingLanguages[bcp].vernacularName}
                <small>({$_('gl.' + bcp)})</small>
              {/if}
            </option>
          {/each}
        </MultiSelect>
      </div>
      <div class="text-xs text-gray-600 mt-1">
        {$_('create.gloss_dictionary_clarification', {
          default: 'Language(s) you want to translate entries into',
        })}
      </div>
    </div>

    <EditCoordinates bind:lat bind:lng />

    <div class="mt-6">
      <div class="text-sm font-medium leading-5 text-gray-700 mb-1">
        {$_('create.alternate_names', { default: 'Alternate Names' })}
      </div>
      <BadgeArray
        bind:strings={alternateNames}
        canEdit
        promptMessage={$_('create.enter_alternate_name', {
          default: 'Enter Alternate Name',
        })}
        addMessage={$_('misc.add', { default: 'Add' })} />
    </div>
    <div class="mt-6 flex">
      <div class="w-1/2">
        <EditString
          bind:attribute={iso6393}
          attributeType="iso6393"
          creation
          display={`<b>ISO 639-3 <a
            href="https://en.wikipedia.org/wiki/ISO_639-3"
            target="_blank"
            class="text-gray-600 hover:text-gray:800">
            <i class="far fa-info-circle" />
          </a></b>`} />
      </div>
      <div class="w-1" />
      <div class="w-1/2">
        <EditString
          bind:attribute={glottocode}
          attributeType="glottocode"
          creation
          display={`<b>Glottocode
            <a
              href="https://en.wikipedia.org/wiki/Glottolog"
              target="_blank"
              class="text-gray-600 hover:text-gray:800">
              <i class="far fa-info-circle" />
            </a></b>`} />
      </div>
    </div>

    <div class="mt-6 flex items-center">
      <input
        id="public"
        type="checkbox"
        bind:checked={publicDictionary}
        on:change={() => {
          setTimeout(() => {
            if (publicDictionary) {
              publicDictionary = confirm(
                `${$_('create.speech_community_permission', {
                  default:
                    "Does the speech community allow this language to be online? Select 'OK' if they have given you permission.",
                })}`
              );
            } else {
              publicDictionary = false;
            }
          }, 5);
        }} />
      <label for="public" class="mx-2 block text-sm leading-5 text-gray-900">
        {$_('create.visible_to_public', { default: 'Visible to Public' })}
        <small class="text-gray-600">
          ({$_('create.req_com_consent', {
            default: 'Requires Community Consent',
          })})
        </small>
      </label>
    </div>

    <div class="mt-6">
      <Button type="submit" class="w-full" form="primary" disabled={!online} loading={submitting}>
        {#if !online}
          Return online to
        {/if}
        {$_('create.create_dictionary', { default: 'Create Dictionary' })}
      </Button>

      <div class="mt-2 text-sm text-gray-600">
        {$_('terms.agree_by_submit', {
          default: 'By submitting this form, you agree to our',
        })}
        <a href="/terms" class="underline" target="_blank"
          >{$_('dictionary.terms_of_use', { default: 'Terms of Use' })}</a
        >.
      </div>
    </div>
  </div>
</form>

{#if modal === 'auth'}
  {#await import('$lib/components/shell/AuthModal.svelte') then { default: AuthModal }}
    <AuthModal
      context="force"
      on:close={() => {
        modal = null;
      }} />
  {/await}
{/if}
