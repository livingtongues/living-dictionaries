<script lang="ts">
  import { t } from 'svelte-i18n';
  import Form from 'svelte-pieces/data/Form.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { user } from '$lib/stores';
  import Header from '$lib/components/shell/Header.svelte';
  import type { IDictionary, IHelper, IPoint, IRegion, IUser } from '@living-dictionaries/types';
  import { docExists, setOnline, updateOnline, firebaseConfig } from 'sveltefirets';
  import { arrayUnion, GeoPoint, serverTimestamp } from 'firebase/firestore/lite';
  import { debounce } from '$lib/helpers/debounce';
  import { pruneObject } from '$lib/helpers/prune';
  import EditableGlossesField from '$lib/components/settings/EditableGlossesField.svelte';
  import WhereSpoken from '$lib/components/settings/WhereSpoken.svelte';
  import EditableAlternateNames from '$lib/components/settings/EditableAlternateNames.svelte';
  import { glossingLanguages } from '@living-dictionaries/parts';
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';

  let modal: 'auth' = null;

  let name = '';
  let glossLanguages = new Set(['en']);
  let alternateNames = [];
  let latitude = null;
  let longitude = null;
  let points: IPoint[] = [];
  let regions: IRegion[] = [];
  let iso6393 = '';
  let glottocode = '';
  let languageUsedByCommunity: boolean;
  let communityPermission: 'yes' | 'no' | 'unknown';
  let authorConnection = '';
  let conLangDescription = '';

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
        $t('create.choose_different_url', {
          default: 'Choose a different URL.',
        })
      );
    }
    try {
      const dictionary: IDictionary = {
        name: name.trim().replace(/^./, name[0].toUpperCase()),
        glossLanguages: Array.from(glossLanguages),
        alternateNames,
        coordinates: latitude ? new GeoPoint(latitude, longitude) : null,
        points,
        regions,
        entryCount: 0,
        iso6393: iso6393.trim(),
        glottocode: glottocode.trim(),
        languageUsedByCommunity,
        communityPermission,
        authorConnection,
        conLangDescription,
      };
      const prunedDictionary = pruneObject(dictionary);
      if (firebaseConfig.projectId === 'talking-dictionaries-dev') {
        console.log(prunedDictionary);
        if (
          !confirm(
            'Dictionary value logged to console because in dev mode. Do you still want to create this dictionary?'
          )
        )
          return;
      }

      await setOnline<IDictionary>(`dictionaries/${url}`, dictionary);
      await setOnline<IHelper>(`dictionaries/${url}/managers/${$user.uid}`, {
        id: $user.uid,
        name: $user.displayName,
      });
      await updateOnline<IUser>(`users/${$user.uid}`, {
        managing: arrayUnion(url),
        termsAgreement: serverTimestamp(),
      });
      window.location.replace(`/${url}/entries/list`);
    } catch (err) {
      alert(`${$t('misc.error', { default: 'Error' })}: ${err}`);
    }
  }

  let online = true;
</script>

<svelte:window bind:online />

<svelte:head>
  <title>
    {$t('create.create_new_dictionary', { default: 'Create New Dictionary' })}
  </title>
</svelte:head>

<Header
  >{$t('create.create_new_dictionary', {
    default: 'Create New Dictionary',
  })}</Header>

<Form let:loading onsubmit={createNewDictionary}>
  <div class="flex-col justify-center p-4 max-w-md mx-auto">
    <label for="name" class="block text-xl font-medium text-gray-700">
      {$t('dictionary.name_of_language', { default: 'Name of Language' })}*
    </label>
    <div class="mt-2 rounded-md shadow-sm">
      <!-- svelte-ignore a11y-autofocus -->
      <input
        id="name"
        type="text"
        autocomplete="off"
        autocorrect="off"
        spellcheck={false}
        autofocus
        minlength="3"
        required
        bind:value={name}
        class="form-input w-full" />
    </div>
    <div class="text-xs text-gray-600 mt-1">
      {$t('create.name_clarification', {
        default: 'This will be the name of the dictionary.',
      })}
    </div>
    <div class="mb-6" />

    {#if name.length > 2}
      <div class="flex justify-between items-center" style="direction: ltr">
        <label for="url" class="text-sm font-medium  text-gray-700"> URL </label>
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
            rounded-r-md sm:text-sm border"
          placeholder="url" />
      </div>
      <div class="text-xs text-gray-600 mt-1">
        {$t('create.permanent_url_msg', {
          default: 'The URL name is permanent and cannot be changed later.',
        })}
        {$t('create.only_letters_numbers', {
          default: 'Only letters and numbers allowed (no spaces or special characters)',
        })}
      </div>
      {#if urlAlreadyExists}
        <div class="text-xs text-red-600 mt-1">
          {$t('create.choose_different_url', {
            default: 'Choose a different URL',
          })}
        </div>
      {/if}
      <div class="mb-6" />

      <EditableGlossesField
        minimum={1}
        availableLanguages={glossingLanguages}
        selectedLanguages={Array.from(glossLanguages)}
        on:add={(e) => {
          glossLanguages.add(e.detail.languageId);
          glossLanguages = glossLanguages;
        }}
        on:remove={(e) => {
          glossLanguages.delete(e.detail.languageId);
          glossLanguages = glossLanguages;
        }} />
      <!-- not used in web app presently -->
      <!-- placeholder={$t('create.languages', { default: 'Language(s)' })} -->
      <div class="mb-6" />

      <EditableAlternateNames
        {alternateNames}
        on:update={(e) => (alternateNames = e.detail.alternateNames)} />
      <div class="mb-6" />

      <WhereSpoken
        dictionary={{ coordinates: { latitude, longitude }, points, regions }}
        on:updateCoordinates={({ detail }) => {
          (latitude = detail.latitude), (longitude = detail.longitude);
        }}
        on:removeCoordinates={() => ((latitude = null), (longitude = null))}
        on:updatePoints={({ detail }) => (points = detail)}
        on:updateRegions={({ detail }) => (regions = detail)} />
      <div class="mb-6" />

      <div class="flex">
        <div class="w-1/2">
          <label for="isocode" class="block text-sm font-medium  text-gray-700">
            ISO 639-3
            <a
              href="https://en.wikipedia.org/wiki/ISO_639-3"
              target="_blank"
              rel="noreferrer"
              class="text-gray-600 hover:text-gray:800">
              <i class="far fa-info-circle" />
            </a>
          </label>
          <div class="mt-1 rounded-md shadow-sm">
            <input
              id="isocode"
              type="text"
              autocomplete="off"
              autocorrect="off"
              spellcheck={false}
              minlength="3"
              maxlength="30"
              bind:value={iso6393}
              class="form-input w-full" />
          </div>
        </div>
        <div class="w-1" />
        <div class="w-1/2">
          <label for="glottocode" class="block text-sm font-medium  text-gray-700">
            Glottocode
            <a
              href="https://en.wikipedia.org/wiki/Glottolog"
              target="_blank"
              rel="noreferrer"
              class="text-gray-600 hover:text-gray:800">
              <i class="far fa-info-circle" />
            </a>
          </label>
          <div class="mt-1 rounded-md shadow-sm">
            <input
              id="glottocode"
              type="text"
              autocomplete="off"
              autocorrect="off"
              spellcheck={false}
              minlength="3"
              maxlength="30"
              bind:value={glottocode}
              class="form-input w-full" />
          </div>
        </div>
      </div>
      <div class="mb-6" />

      <div class="mb-2 text-sm font-medium text-gray-700">
        {$t('create.language_used_by_community', {
          default:
            'Is this dictionary for a language that is spoken or signed by a specific human community?',
        })}
      </div>

      <label class="block">
        <input
          type="radio"
          name="languageUsedByCommunity"
          bind:group={languageUsedByCommunity}
          value={true}
          required />
        {$t('misc.assertion', { default: 'Yes' })}
      </label>

      <label class="block">
        <input
          type="radio"
          name="languageUsedByCommunity"
          bind:group={languageUsedByCommunity}
          value={false} />
        {$t('misc.negation', { default: 'No' })}
      </label>
      <div class="mb-6" />

      <div class="mb-2 text-sm font-medium text-gray-700">
        {$t('create.community_permission', {
          default: 'Has the language community given you permission to make this dictionary?',
        })}
        <!-- Similar to create.speech_community_permission but not the same -->
      </div>
      <label class="block">
        <input
          type="radio"
          name="communityPermission"
          bind:group={communityPermission}
          value={'yes'}
          required />
        {$t('misc.assertion', { default: 'Yes' })}
      </label>

      <label class="block">
        <input
          type="radio"
          name="communityPermission"
          bind:group={communityPermission}
          value={'no'} />
        {$t('misc.negation', { default: 'No' })}
      </label>

      <label class="block">
        <input
          type="radio"
          name="communityPermission"
          bind:group={communityPermission}
          value={'unknown'} />
        {$t('create.uncertainty', { default: 'I don’t know' })}
      </label>
      <div class="mb-6" />

      <label class="block mb-2 text-sm font-medium text-gray-700" for="authorConnection">
        {$t('create.author_connection', {
          default:
            'Please briefly describe how you know this language and why you are creating a Living Dictionary for it. Are you part of the community that will be using this Living Dictionary? If not, how do you know the community?',
        })}
      </label>
      <textarea
        name="authorConnection"
        required
        rows="5"
        minlength="100"
        maxlength="2500"
        bind:value={authorConnection}
        class="form-input w-full" />
      <div class="flex text-xs">
        <div class="text-gray-500 ml-auto">{authorConnection.length}/2500</div>
      </div>
      <div class="mb-6" />

      <label class="block mb-2 text-sm font-medium text-gray-700" for="conLangDescription">
        {$t('create.con_lang_description', {
          default:
            'Is this dictionary for a constructed language (a language invented by humans in recent years, for a book or a movie)? If yes, please briefly describe.',
        })}
      </label>
      <textarea
        name="conLangDescription"
        rows="3"
        minlength="40"
        maxlength="1000"
        bind:value={conLangDescription}
        class="form-input w-full" />
      <div class="flex text-xs">
        <div class="text-gray-500 ml-auto">{conLangDescription.length}/1000</div>
      </div>
      <div class="mb-6" />

      <Button type="submit" class="w-full" form="filled" disabled={!online} {loading}>
        {#if !online}
          Return online to
        {/if}
        {$t('create.create_dictionary', { default: 'Create Dictionary' })}
      </Button>

      <div class="mt-2 text-sm text-gray-600">
        {$t('terms.agree_by_submit', {
          default: 'By submitting this form, you agree to our',
        })}
        <a href="/terms" class="underline" target="_blank"
          >{$t('dictionary.terms_of_use', { default: 'Terms of Use' })}</a
        >.
      </div>
      <div class="mb-6" />
    {/if}
  </div>
</Form>

{#if modal === 'auth'}
  {#await import('$lib/components/shell/AuthModal.svelte') then { default: AuthModal }}
    <AuthModal
      context="force"
      on:close={() => {
        modal = null;
      }} />
  {/await}
{/if}

<SeoMetaTags
  title={$t('create.create_new_dictionary', { default: 'Create New Dictionary' })}
  description={$t('', {
    default:
      'Build a new Living Dictionary in a few short steps. Create a title and set the URL, and then configure the settings. Living Dictionaries are comprehensive, free, online technological tools integrating audio, images and video.',
  })}
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary" />
