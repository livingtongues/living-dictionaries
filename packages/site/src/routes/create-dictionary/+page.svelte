<script lang="ts">
  import { Button, Form } from 'svelte-pieces'
  import type { IPoint, IRegion } from '@living-dictionaries/types'
  import { onMount } from 'svelte'
  import { convertToFriendlyUrl } from './convertToFriendlyUrl'
  import { page } from '$app/stores'
  import Header from '$lib/components/shell/Header.svelte'
  import EditableGlossesField from '$lib/components/settings/EditableGlossesField.svelte'
  import WhereSpoken from '$lib/components/settings/WhereSpoken.svelte'
  import EditableAlternateNames from '$lib/components/settings/EditableAlternateNames.svelte'
  import { glossingLanguages } from '$lib/glosses/glossing-languages'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { debounce } from '$lib/helpers/debounce'
  import { browser, dev } from '$app/environment'

  export let data
  $: ({ user } = data)

  const MAX_URL_LENGTH = 25

  let modal: 'auth' = null

  let name = ''
  let gloss_languages = new Set(['en'])
  let alternate_names: string[] = []
  let points: IPoint[] = []
  let regions: IRegion[] = []
  let iso_639_3 = ''
  let glottocode = ''
  let conlang: boolean
  let community_permission: 'yes' | 'no' | 'unknown'
  let author_connection = ''
  let conlang_source = ''
  let conlang_use = ''

  $: urlFromName = convertToFriendlyUrl(name, MAX_URL_LENGTH)
  let customUrl: string
  $: urlToUse = customUrl || urlFromName
  let isUniqueURL = true

  const debouncedCheckIfUniqueUrl = debounce(checkIfUniqueUrl, 500)
  $: if (urlToUse.length >= data.MIN_URL_LENGTH) debouncedCheckIfUniqueUrl(urlToUse)

  async function checkIfUniqueUrl(url: string): Promise<boolean> {
    isUniqueURL = !(await data.dictionary_id_exists(url))
    return isUniqueURL
  }

  function handleUrlKeyup(e: Event) {
    const newCustomUrl = (e.target as HTMLInputElement).value
    if (customUrl !== newCustomUrl)
      customUrl = convertToFriendlyUrl(newCustomUrl, MAX_URL_LENGTH)
  }

  onMount(() => {
    if (dev && browser) {
      name = `Test${Date.now()}`
      conlang = false
      community_permission = 'no'
      author_connection = 'aaaaa '.repeat(10)
    }
  })
</script>

<Header>{$page.data.t('create.create_new_dictionary')}</Header>

<Form
  let:loading
  onsubmit={async () => {
    if (!$user) return modal = 'auth'

    await data.create_dictionary({
      id: urlToUse,
      url: urlToUse,
      name: name.trim().replace(/^./, name[0].toUpperCase()),
      gloss_languages: Array.from(gloss_languages),
      alternate_names,
      coordinates: points || regions ? { points, regions } : null,
      iso_639_3: iso_639_3.trim(),
      glottocode: glottocode.trim(),
      community_permission,
      author_connection,
      con_language_description: conlang
        ? `Source: ${conlang_source.trim()}

Use: ${conlang_use.trim()}`
        : null,
    })
  }}>
  <div class="flex-col justify-center p-4 max-w-md mx-auto">
    <label for="name" class="block text-xl font-medium text-gray-700">
      {$page.data.t('dictionary.name_of_language')}*
    </label>
    <div class="mt-2 rounded-md shadow-sm">
      <input
        id="name"
        type="text"
        autocomplete="off"
        autocorrect="off"
        spellcheck={false}
        autofocus
        minlength={data.MIN_URL_LENGTH}
        required
        bind:value={name}
        class="form-input w-full" />
    </div>
    <div class="text-xs text-gray-600 mt-1">
      {$page.data.t('create.name_clarification')}
    </div>
    <div class="mb-6" />

    {#if name.length > 2}
      {#if dev}
        <Button type="submit" class="mb-5 w-full" color="red">
          Dev: Add Test Dictionary Immediately
        </Button>
      {/if}
      <div class="flex justify-between items-center" style="direction: ltr">
        <label for="url" class="text-sm font-medium text-gray-700"> URL </label>
      </div>

      <div class="mt-1 flex rounded-md shadow-sm" style="direction: ltr">
        <span
          class="inline-flex items-center px-2 rounded-l-md border border-r-0
            border-gray-300 bg-gray-50 text-gray-500 text-sm">
          livingdictionaries.app/
        </span>
        <input
          id="url"
          value={customUrl || urlFromName}
          on:keyup={handleUrlKeyup}
          required
          minlength={data.MIN_URL_LENGTH}
          maxlength={MAX_URL_LENGTH}
          autocomplete="off"
          autocorrect="off"
          spellcheck={false}
          class="form-input flex-1 block w-full px-2 sm:px-3 py-2 rounded-none
            rounded-r-md sm:text-sm border"
          placeholder="url" />
      </div>
      <div class="text-xs text-gray-600 mt-1">
        {$page.data.t('create.permanent_url_msg')}
        {$page.data.t('create.only_letters_numbers')}
      </div>
      {#if urlToUse.length >= data.MIN_URL_LENGTH && !isUniqueURL}
        <div class="text-xs text-red-600 mt-1">
          {$page.data.t('create.choose_different_url')}
        </div>
      {/if}
      <div class="mb-6" />

      <div class="mb-2 text-sm font-medium text-gray-700">
        {$page.data.t('create.conlang_question')}
      </div>

      <label class="block">
        <input
          type="radio"
          name="conlang"
          bind:group={conlang}
          value={true}
          required />
        {$page.data.t('misc.assertion')}
      </label>

      <label class="block">
        <input
          type="radio"
          name="conlang"
          bind:group={conlang}
          value={false} />
        {$page.data.t('misc.negation')}
      </label>
      <div class="mb-6" />

      {#if !conlang}
        <div class="mb-3 font-semibold">
          {$page.data.t('create.conlang_warning')}
        </div>
        <div class="mb-6" />
      {/if}

      {#if conlang === true}
        <div class="mb-3 font-italic">
          {$page.data.t('create.conlang_info_1')}
        </div>
        <div class="mb-3 font-italic">
          {$page.data.t('create.conlang_info_2')}
        </div>
        <div class="mb-6" />
        <div>
          <input type="checkbox" id="agreement" name="agreement" required />
          <label for="agreement">{$page.data.t('create.agree_above')}</label>
        </div>
        <div>
          <input type="checkbox" id="citeAgreement" name="citeAgreement" required />
          <label for="citeAgreement">{$page.data.t('create.agree_to_cite')}</label>
        </div>
        <div>
          <input type="checkbox" id="non-commercialAgreement" name="non-commercialAgreement" required />
          <label for="non-commercialAgreement">{$page.data.t('create.agree_for_non-commercial')}</label>
        </div>
        <div class="mb-6" />

        <label class="block mb-2 text-sm font-medium text-gray-700" for="conlangInfo">
          {$page.data.t('create.source_question')}
        </label>
        <textarea
          name="conlangInfo"
          required
          rows="5"
          minlength="100"
          maxlength="2500"
          bind:value={conlang_source}
          class="form-input w-full" />
        <div class="flex text-xs">
          <div class="text-gray-500 ml-auto">{conlang_source.length}/2500</div>
        </div>
        <div class="mb-6" />

        <label class="block mb-2 text-sm font-medium text-gray-700" for="conlangUse">
          {$page.data.t('create.use_question')}
        </label>
        <textarea
          name="conlangUse"
          required
          rows="5"
          minlength="100"
          maxlength="2500"
          bind:value={conlang_use}
          class="form-input w-full" />
        <div class="flex text-xs">
          <div class="text-gray-500 ml-auto">{conlang_use.length}/2500</div>
        </div>
        <div class="mb-6" />
      {/if}

      {#if conlang != null}
        <EditableGlossesField
          minimum={1}
          availableLanguages={glossingLanguages}
          selectedLanguages={Array.from(gloss_languages)}
          add_language={(languageId) => {
            gloss_languages.add(languageId)
            gloss_languages = gloss_languages
          }}
          remove_language={(languageId) => {
            gloss_languages.delete(languageId)
            gloss_languages = gloss_languages
          }} />
        <div class="mb-6" />

        <EditableAlternateNames
          alternateNames={alternate_names}
          on_update={new_value => alternate_names = new_value} />
        <div class="mb-6" />

        <!-- <div class="mb-2 text-sm font-medium text-gray-700">
          {$page.data.t('create.language_used_by_community')}*
        </div>

        <label class="block">
          <input
            type="radio"
            name="languageUsedByCommunity"
            bind:group={language_used_by_community}
            value={true}
            required />
          {$page.data.t('misc.assertion')}
        </label>

        <label class="block">
          <input
            type="radio"
            name="languageUsedByCommunity"
            bind:group={language_used_by_community}
            value={false} />
          {$page.data.t('misc.negation')}
        </label>
        <div class="mb-6" /> -->
      {/if}

      {#if conlang === false}
        <WhereSpoken
          dictionary={{ coordinates: { points, regions } }}
          on_update_points={new_points => points = new_points}
          on_update_regions={new_regions => regions = new_regions} />
        <div class="mb-6" />

        <div class="flex">
          <div class="w-1/2">
            <label for="isocode" class="block text-sm font-medium text-gray-700">
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
                bind:value={iso_639_3}
                class="form-input w-full" />
            </div>
          </div>
          <div class="w-1" />
          <div class="w-1/2">
            <label for="glottocode" class="block text-sm font-medium text-gray-700">
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
          {$page.data.t('create.community_permission')}*
        </div>
        <label class="block">
          <input
            type="radio"
            name="communityPermission"
            bind:group={community_permission}
            value="yes"
            required />
          {$page.data.t('misc.assertion')}
        </label>

        <label class="block">
          <input
            type="radio"
            name="communityPermission"
            bind:group={community_permission}
            value="no" />
          {$page.data.t('misc.negation')}
        </label>

        <label class="block">
          <input
            type="radio"
            name="communityPermission"
            bind:group={community_permission}
            value="unknown" />
          {$page.data.t('create.uncertainty')}
        </label>
        <div class="mb-6" />

        <label class="block mb-2 text-sm font-medium text-gray-700" for="authorConnection">
          {$page.data.t('create.author_connection')}*
        </label>
        <textarea
          name="authorConnection"
          required
          rows="5"
          minlength="100"
          maxlength="2500"
          bind:value={author_connection}
          class="form-input w-full" />
        <div class="flex text-xs">
          <div class="text-gray-500 ml-auto">{author_connection.length}/2500</div>
        </div>
        <div class="mb-6" />

        <div>
          <input type="checkbox" id="citeAgreement" name="citeAgreement" required />
          <label for="citeAgreement">{$page.data.t('create.agree_to_cite')}</label>
        </div>
        <div>
          <input type="checkbox" id="non-commercialAgreement" name="non-commercialAgreement" required />
          <label for="non-commercialAgreement">{$page.data.t('create.agree_for_non-commercial')}</label>
        </div>
        <div class="mb-6" />
      {/if}

      <Button type="submit" class="w-full" form="filled" {loading}>
        {$page.data.t('create.create_dictionary')}
      </Button>

      <div class="mt-2 text-sm text-gray-600">
        {$page.data.t('terms.agree_by_submit')}
        <a href="/terms" class="underline" target="_blank">{$page.data.t('dictionary.terms_of_use')}</a>.
      </div>
      <div class="mb-6" />
    {/if}
  </div>
</Form>

{#if modal === 'auth'}
  {#await import('$lib/components/shell/AuthModal.svelte') then { default: AuthModal }}
    <AuthModal
      context="force"
      on_close={() => {
        modal = null
      }} />
  {/await}
{/if}

<SeoMetaTags
  title={$page.data.t('create.create_new_dictionary')}
  description="Build a new Living Dictionary in a few short steps. Create a title and set the URL, and then configure the settings. Living Dictionaries are comprehensive, free, online technological tools integrating audio, images and video."
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary" />
