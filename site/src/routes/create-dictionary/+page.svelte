<script lang="ts">
  import IconInfoCircle from '~icons/fa-solid/info-circle'
  import type { IPoint, IRegion } from '$lib/types'
  import { onMount } from 'svelte'
  import { convertToFriendlyUrl, is_url_like } from './convert-to-friendly-url'
  import { log_event } from '$lib/debug/remote-log'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import Form from '$lib/components/ui/Form.svelte'
  import { page } from '$app/state'
  import Header from '$lib/components/shell/Header.svelte'
  import EditableGlossesField from '$lib/components/settings/EditableGlossesField.svelte'
  import WhereSpoken from '$lib/components/settings/WhereSpoken.svelte'
  import EditableAlternateNames from '$lib/components/settings/EditableAlternateNames.svelte'
  import { glossing_languages } from '$lib/glosses/glossing-languages'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { debounce } from '$lib/utils/debounce'
  import { browser, dev } from '$app/environment'

  const { data } = $props()
  const user = $derived(data.auth_user.user)

  const MAX_URL_LENGTH = 25

  let modal: 'auth' = $state(null)

  let name = $state('')
  let gloss_languages: string[] = $state(['en'])
  let alternate_names: string[] = $state([])
  let points: IPoint[] = $state([])
  let regions: IRegion[] = $state([])
  let iso_639_3 = $state('')
  let glottocode = $state('')
  let conlang: boolean = $state()
  let community_permission: 'yes' | 'no' | 'unknown' = $state()
  let author_connection = $state('')
  let conlang_source = $state('')
  let conlang_use = $state('')

  const urlFromName = $derived(convertToFriendlyUrl(name, MAX_URL_LENGTH))
  let customUrl: string = $state()
  const urlToUse = $derived(customUrl || urlFromName)
  let isUniqueURL = $state(true)

  const debouncedCheckIfUniqueUrl = debounce(checkIfUniqueUrl, 500)
  $effect(() => {
    if (urlToUse.length >= data.MIN_URL_LENGTH) debouncedCheckIfUniqueUrl(urlToUse)
  })

  async function checkIfUniqueUrl(url: string): Promise<boolean> {
    isUniqueURL = !(await data.dictionary_id_exists(url))
    return isUniqueURL
  }

  // Set when the raw name/url input reads like a pasted URL (the slug generator
  // cleans it, but flag the attempt — a truncated paste once shipped as the
  // unusable slug `httpslivingdictionari`).
  let url_like_input: string | null = $state(null)

  function handle_url_input(e: Event) {
    const newCustomUrl = (e.target as HTMLInputElement).value
    if (is_url_like(newCustomUrl))
      url_like_input = newCustomUrl
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

<Header>{page.data.t('create.create_new_dictionary')}</Header>

<Form

  onsubmit={async () => {
    if (!user) return modal = 'auth'

    if (url_like_input || is_url_like(name) || /http|www/.test(urlToUse))
      log_event({ level: 'warn', message: 'dict_slug_suspicious', context: { name, url: urlToUse, raw_input: url_like_input } })

    await data.create_dictionary({
      id: urlToUse,
      url: urlToUse,
      name: name.trim().replace(/^./, name[0].toUpperCase()),
      gloss_languages,
      alternate_names,
      coordinates: points || regions ? { points, regions } : null,
      iso_639_3: iso_639_3.trim(),
      glottocode: glottocode.trim(),
      community_permission,
      author_connection,
      conlang,
      con_language_description: conlang
        ? `Source: ${conlang_source.trim()}

Use: ${conlang_use.trim()}`
        : null,
    })
  }}>
  {#snippet children({ loading })}
    <div class="create-form">
      <label for="name" class="label-xl">
        {page.data.t('dictionary.name_of_language')}*
      </label>
      <div class="input-shadow-wrap" style="margin-top: 0.5rem">
        <input
          id="name"
          type="text"
          autocomplete="off"
          autocorrect="off"
          spellcheck={false}
          autofocus
          minlength={data.MIN_URL_LENGTH}
          maxlength="100"
          required
          bind:value={name} />
      </div>
      <div class="hint">
        {page.data.t('create.name_clarification')}
      </div>
      <div class="spacer"></div>

      {#if name.length > 2}
        {#if dev}
          <HeadlessButton type="submit" class="btn btn-default dev-button">
            Dev: Add Test Dictionary Immediately
          </HeadlessButton>
        {/if}
        <div class="url-label-row" style="direction: ltr">
          <label for="url" class="label-sm"> URL </label>
        </div>

        <div class="url-row" style="direction: ltr">
          <span class="url-prefix">
            livingdictionaries.app/
          </span>
          <input
            id="url"
            value={customUrl || urlFromName}
            oninput={handle_url_input}
            required
            minlength={data.MIN_URL_LENGTH}
            maxlength={MAX_URL_LENGTH}
            autocomplete="off"
            autocorrect="off"
            spellcheck={false}
            class="url-input"
            placeholder="url" />
        </div>
        <div class="hint">
          {page.data.t('create.permanent_url_msg')}
          {page.data.t('create.only_letters_numbers')}
        </div>
        {#if urlToUse.length >= data.MIN_URL_LENGTH && !isUniqueURL}
          <div class="url-error">
            {page.data.t('create.choose_different_url')}
          </div>
        {/if}
        <div class="spacer"></div>

        <div class="label-sm stack-label">
          {page.data.t('create.conlang_question')}
        </div>

        <label class="radio-label">
          <input
            type="radio"
            name="conlang"
            bind:group={conlang}
            value={true}
            required />
          {page.data.t('misc.assertion')}
        </label>

        <label class="radio-label">
          <input
            type="radio"
            name="conlang"
            bind:group={conlang}
            value={false} />
          {page.data.t('misc.negation')}
        </label>
        <div class="spacer"></div>

        {#if !conlang}
          <div class="conlang-warning">
            {page.data.t('create.conlang_warning')}
          </div>
          <div class="spacer"></div>
        {/if}

        {#if conlang === true}
          <div class="conlang-info">
            {page.data.t('create.conlang_info_1')}
          </div>
          <div class="conlang-info">
            {page.data.t('create.conlang_info_2')}
          </div>
          <div class="spacer"></div>
          <div class="checkbox-row">
            <input type="checkbox" id="agreement" name="agreement" required />
            <label for="agreement">{page.data.t('create.agree_above')}</label>
          </div>
          <div class="checkbox-row">
            <input type="checkbox" id="citeAgreement" name="citeAgreement" required />
            <label for="citeAgreement">{page.data.t('create.agree_to_cite')}</label>
          </div>
          <div class="checkbox-row">
            <input type="checkbox" id="non-commercialAgreement" name="non-commercialAgreement" required />
            <label for="non-commercialAgreement">{page.data.t('create.agree_for_non-commercial')}</label>
          </div>
          <div class="spacer"></div>

          <label class="label-sm stack-label" for="conlangInfo">
            {page.data.t('create.source_question')}
          </label>
          <textarea
            name="conlangInfo"
            required
            rows="5"
            minlength="100"
            maxlength="2500"
            bind:value={conlang_source}></textarea>
          <div class="counter-row">
            <div class="counter">{conlang_source.length}/2500</div>
          </div>
          <div class="spacer"></div>

          <label class="label-sm stack-label" for="conlangUse">
            {page.data.t('create.use_question')}
          </label>
          <textarea
            name="conlangUse"
            required
            rows="5"
            minlength="100"
            maxlength="2500"
            bind:value={conlang_use}></textarea>
          <div class="counter-row">
            <div class="counter">{conlang_use.length}/2500</div>
          </div>
          <div class="spacer"></div>
        {/if}

        {#if conlang != null}
          <EditableGlossesField
            minimum={1}
            availableLanguages={glossing_languages}
            selectedLanguages={gloss_languages}
            add_language={(languageId) => {
              if (!gloss_languages.includes(languageId))
                gloss_languages = [...gloss_languages, languageId]
            }}
            remove_language={(languageId) => {
              gloss_languages = gloss_languages.filter(id => id !== languageId)
            }} />
          <div class="spacer"></div>

          <EditableAlternateNames
            alternateNames={alternate_names}
            on_update={new_value => alternate_names = new_value} />
          <div class="spacer"></div>

          <!-- <div class="label-sm stack-label">
            {page.data.t('create.language_used_by_community')}*
          </div>

          <label class="radio-label">
            <input
              type="radio"
              name="languageUsedByCommunity"
              bind:group={language_used_by_community}
              value={true}
              required />
            {page.data.t('misc.assertion')}
          </label>

          <label class="radio-label">
            <input
              type="radio"
              name="languageUsedByCommunity"
              bind:group={language_used_by_community}
              value={false} />
            {page.data.t('misc.negation')}
          </label>
          <div class="spacer" /> -->
        {/if}

        {#if conlang === false}
          <WhereSpoken
            dictionary={{ coordinates: { points, regions } }}
            on_update_points={new_points => points = new_points}
            on_update_regions={new_regions => regions = new_regions} />
          <div class="spacer"></div>

          <div style="display: flex">
            <div style="width: 50%">
              <label for="isocode" class="label-sm" style="display: block">
                ISO 639-3
                <a
                  href="https://en.wikipedia.org/wiki/ISO_639-3"
                  target="_blank"
                  rel="noreferrer"
                  class="info-link">
                  <IconInfoCircle />
                </a>
              </label>
              <div class="input-shadow-wrap" style="margin-top: 0.25rem">
                <input
                  id="isocode"
                  type="text"
                  autocomplete="off"
                  autocorrect="off"
                  spellcheck={false}
                  minlength="3"
                  maxlength="30"
                  bind:value={iso_639_3} />
              </div>
            </div>
            <div style="width: 0.25rem"></div>
            <div style="width: 50%">
              <label for="glottocode" class="label-sm" style="display: block">
                Glottocode
                <a
                  href="https://en.wikipedia.org/wiki/Glottolog"
                  target="_blank"
                  rel="noreferrer"
                  class="info-link">
                  <IconInfoCircle />
                </a>
              </label>
              <div class="input-shadow-wrap" style="margin-top: 0.25rem">
                <input
                  id="glottocode"
                  type="text"
                  autocomplete="off"
                  autocorrect="off"
                  spellcheck={false}
                  minlength="3"
                  maxlength="30"
                  bind:value={glottocode} />
              </div>
            </div>
          </div>
          <div class="spacer"></div>

          <div class="label-sm stack-label">
            {page.data.t('create.community_permission')}*
          </div>
          <label class="radio-label">
            <input
              type="radio"
              name="communityPermission"
              bind:group={community_permission}
              value="yes"
              required />
            {page.data.t('misc.assertion')}
          </label>

          <label class="radio-label">
            <input
              type="radio"
              name="communityPermission"
              bind:group={community_permission}
              value="no" />
            {page.data.t('misc.negation')}
          </label>

          <label class="radio-label">
            <input
              type="radio"
              name="communityPermission"
              bind:group={community_permission}
              value="unknown" />
            {page.data.t('create.uncertainty')}
          </label>
          <div class="spacer"></div>

          <label class="label-sm stack-label" for="authorConnection">
            {page.data.t('create.author_connection')}*
          </label>
          <textarea
            name="authorConnection"
            required
            rows="5"
            minlength="100"
            maxlength="2500"
            bind:value={author_connection}></textarea>
          <div class="counter-row">
            <div class="counter">{author_connection.length}/2500</div>
          </div>
          <div class="spacer"></div>

          <div class="checkbox-row">
            <input type="checkbox" id="citeAgreement" name="citeAgreement" required />
            <label for="citeAgreement">{page.data.t('create.agree_to_cite')}</label>
          </div>
          <div class="checkbox-row">
            <input type="checkbox" id="non-commercialAgreement" name="non-commercialAgreement" required />
            <label for="non-commercialAgreement">{page.data.t('create.agree_for_non-commercial')}</label>
          </div>
          <div class="spacer"></div>
        {/if}

        <HeadlessButton type="submit" class="btn-primary btn-default submit-button" {loading}>
          {page.data.t('create.create_dictionary')}
        </HeadlessButton>

        <div class="terms-note">
          {page.data.t('terms.agree_by_submit')}
          <a href="/terms" style="text-decoration-line: underline">{page.data.t('dictionary.terms_of_use')}</a>.
        </div>
        <div class="spacer"></div>
      {/if}
    </div>
  {/snippet}
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
  title={page.data.t('create.create_new_dictionary')}
  description="Build a new Living Dictionary in a few short steps. Create a title and set the URL, and then configure the settings. Living Dictionaries are comprehensive, free, online technological tools integrating audio, images and video."
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary" />

<style>
  .create-form {
    flex-direction: column; /* (was flex-col without display:flex — inert, kept for parity) */
    justify-content: center;
    padding: 1rem;
    max-width: 28rem;
    margin-left: auto;
    margin-right: auto;
  }

  .label-xl {
    display: block;
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
  }

  .label-sm {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
  }

  .stack-label {
    display: block;
    margin-bottom: 0.5rem;
  }

  .input-shadow-wrap {
    border-radius: 0.375rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); /* shadow-sm */
  }

  .create-form input:not([type='radio']):not([type='checkbox']),
  .create-form select {
    width: 100%;
  }

  .hint {
    font-size: 0.75rem;
    line-height: 1rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    margin-top: 0.25rem;
  }

  .spacer {
    margin-bottom: 1.5rem;
  }

  .create-form :global(.dev-button) {
    margin-bottom: 1.25rem;
    width: 100%;
  }

  .url-label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .url-row {
    margin-top: 0.25rem;
    display: flex;
    border-radius: 0.375rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); /* shadow-sm */
  }

  .url-prefix {
    display: inline-flex;
    align-items: center;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    border-top-left-radius: 0.375rem;
    border-bottom-left-radius: 0.375rem;
    border: 1px solid color-mix(in srgb, var(--background), var(--color) 18%); /* ≈ gray-300 */
    border-right: 0;
    background-color: color-mix(in srgb, var(--background), var(--color) 2%); /* ≈ gray-50 */
    color: var(--color-secondary); /* ≈ gray-500 */
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  .create-form .url-input {
    flex: 1 1 0%;
    display: block;
    padding: 0.5rem;
    border-radius: 0;
    border-top-right-radius: 0.375rem;
    border-bottom-right-radius: 0.375rem;
    border-width: 1px;
  }

  @media (min-width: 640px) {
    .create-form .url-input {
      padding-left: 0.75rem;
      padding-right: 0.75rem;
      font-size: 0.875rem;
      line-height: 1.25rem;
    }
  }

  .url-error {
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--danger); /* ≈ red-600 */
    margin-top: 0.25rem;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
    cursor: pointer;
  }

  .radio-label input {
    flex: none;
    margin: 0;
  }

  .checkbox-row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .checkbox-row input {
    flex: none;
    margin: 0;
    margin-top: 0.2rem;
  }

  .checkbox-row label {
    cursor: pointer;
  }

  .conlang-warning {
    margin-bottom: 0.75rem;
    font-weight: 600;
  }

  .conlang-info {
    margin-bottom: 0.75rem;
    font-style: italic;
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

  .info-link {
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 (the old hover:text-gray:800 was a typo that generated nothing) */
  }

  .create-form :global(.submit-button) {
    width: 100%;
  }

  .terms-note {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
  }
</style>
