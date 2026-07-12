<script lang="ts">
  // TEMPORARY review page (delete after picks are applied — .issues/ui-skill-alignment.md).
  // The FA kit (Pro 5.15.4) was removed from app.html during the ~icons swap; this page
  // re-injects it locally so the true Pro-regular originals render for comparison.
  import { onMount } from 'svelte'
  import type { Component } from 'svelte'
  import IconSolidInfoCircle from '~icons/fa-solid/info-circle'
  import IconSolidDonate from '~icons/fa-solid/donate'
  import IconSolidUpload from '~icons/fa-solid/upload'
  import IconSolidTimes from '~icons/fa-solid/times'
  import IconSolidSignInAlt from '~icons/fa-solid/sign-in-alt'
  import IconSolidKey from '~icons/fa-solid/key'
  import IconSolidBars from '~icons/fa-solid/bars'
  import IconSolidUndo from '~icons/fa-solid/undo'
  import IconSolidSpinner from '~icons/fa-solid/spinner'
  import IconSolidPencilAlt from '~icons/fa-solid/pencil-alt'
  import IconSolidLink from '~icons/fa-solid/link'
  import IconSolidLanguage from '~icons/fa-solid/language'
  import IconSolidFilm from '~icons/fa-solid/film'
  import IconSolidCheck from '~icons/fa-solid/check'
  import IconMdiInformationOutline from '~icons/mdi/information-outline'
  import IconMdiHandCoinOutline from '~icons/mdi/hand-coin-outline'
  import IconMdiUploadOutline from '~icons/mdi/upload-outline'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiLogin from '~icons/mdi/login'
  import IconMdiKeyOutline from '~icons/mdi/key-outline'
  import IconMdiMenu from '~icons/mdi/menu'
  import IconMdiUndo from '~icons/mdi/undo'
  import IconMdiLoading from '~icons/mdi/loading'
  import IconMdiPencilOutline from '~icons/mdi/pencil-outline'
  import IconMdiLinkVariant from '~icons/mdi/link-variant'
  import IconMdiTranslate from '~icons/mdi/translate'
  import IconMdiMovieOpenOutline from '~icons/mdi/movie-open-outline'
  import IconMdiCheck from '~icons/mdi/check'

  let { data } = $props()

  let kit_loaded = $state(false)
  onMount(() => {
    const script = document.createElement('script')
    script.src = 'https://kit.fontawesome.com/b5a05fc445.js'
    script.crossOrigin = 'anonymous'
    script.onload = () => kit_loaded = true
    document.head.appendChild(script)
    return () => script.remove()
  })

  interface Glyph {
    name: string
    usage: string
    solid: Component
    mdi: Component
    mdi_name: string
    choice: 'solid' | 'mdi'
  }

  const glyphs: Glyph[] = $state([
    { name: 'info-circle', usage: 'About links (header, side menu, create-dictionary hints) ×5', solid: IconSolidInfoCircle, mdi: IconMdiInformationOutline, mdi_name: 'information-outline', choice: 'solid' },
    { name: 'donate', usage: 'Donate links (header, side menu) ×3', solid: IconSolidDonate, mdi: IconMdiHandCoinOutline, mdi_name: 'hand-coin-outline', choice: 'solid' },
    { name: 'upload', usage: 'Select audio/video upload buttons ×2', solid: IconSolidUpload, mdi: IconMdiUploadOutline, mdi_name: 'upload-outline', choice: 'solid' },
    { name: 'times', usage: 'Close side menu ×2', solid: IconSolidTimes, mdi: IconMdiClose, mdi_name: 'close', choice: 'solid' },
    { name: 'sign-in', usage: 'Sign in (user menu, invite page) ×2', solid: IconSolidSignInAlt, mdi: IconMdiLogin, mdi_name: 'login', choice: 'solid' },
    { name: 'key', usage: 'Private-dictionary lock (language select, dictionaries list) ×2', solid: IconSolidKey, mdi: IconMdiKeyOutline, mdi_name: 'key-outline', choice: 'solid' },
    { name: 'bars', usage: 'Hamburger menu (header, dict layout) ×2', solid: IconSolidBars, mdi: IconMdiMenu, mdi_name: 'menu', choice: 'solid' },
    { name: 'undo', usage: 'Clear filters button', solid: IconSolidUndo, mdi: IconMdiUndo, mdi_name: 'undo', choice: 'solid' },
    { name: 'spinner', usage: 'Video recording "accessing camera" spinner', solid: IconSolidSpinner, mdi: IconMdiLoading, mdi_name: 'loading', choice: 'solid' },
    { name: 'pencil', usage: 'Edit dictionaries (admin table link)', solid: IconSolidPencilAlt, mdi: IconMdiPencilOutline, mdi_name: 'pencil-outline', choice: 'solid' },
    { name: 'link', usage: 'Paste video link', solid: IconSolidLink, mdi: IconMdiLinkVariant, mdi_name: 'link-variant', choice: 'solid' },
    { name: 'language', usage: 'Language picker (header)', solid: IconSolidLanguage, mdi: IconMdiTranslate, mdi_name: 'translate', choice: 'solid' },
    { name: 'film-alt', usage: 'Video modal heading', solid: IconSolidFilm, mdi: IconMdiMovieOpenOutline, mdi_name: 'movie-open-outline', choice: 'solid' },
    { name: 'check', usage: 'Upload complete indicator', solid: IconSolidCheck, mdi: IconMdiCheck, mdi_name: 'check', choice: 'solid' },
  ])

  const summary = $derived(glyphs.map(g => `${g.name}:${g.choice === 'solid' ? 'S' : 'M'}`).join(' '))
</script>

{#if data.auth_user.admin_level >= 3}
  <div class="wrapper">
    <h1>Icon review — FA Pro regular replacements</h1>
    <p style="color: var(--color-secondary); max-width: 60rem">
      The Font Awesome Pro kit was removed; these 14 glyphs had Pro-only regular (outline) weights
      with no free equivalent. Each currently ships the <b>fa-solid</b> fallback. Tap the option you
      prefer per row, then screenshot this page back.
      {#if !kit_loaded}<b>(Pro originals still loading…)</b>{/if}
    </p>

    <div class="grid">
      <div class="head">glyph</div>
      <div class="head">original (Pro regular)</div>
      <div class="head">fa-solid (current)</div>
      <div class="head">mdi</div>
      {#each glyphs as glyph (glyph.name)}
        <div class="name">
          <b>{glyph.name}</b>
          <div style="font-size: 0.75rem; color: var(--color-secondary)">{glyph.usage}</div>
        </div>
        <div class="option original">
          <i class="far fa-{glyph.name}"></i>
        </div>
        <button type="button" class="option" class:selected={glyph.choice === 'solid'} onclick={() => glyph.choice = 'solid'}>
          <glyph.solid />
        </button>
        <button type="button" class="option" class:selected={glyph.choice === 'mdi'} onclick={() => glyph.choice = 'mdi'}>
          <glyph.mdi />
          <div class="mdi-name">{glyph.mdi_name}</div>
        </button>
      {/each}
    </div>

    <div class="summary">{summary}</div>
  </div>
{:else}
  <p style="padding: 1rem">Requires admin level 3.</p>
{/if}

<style>
  .wrapper {
    padding: 1rem 1.5rem 3rem;
  }

  .grid {
    display: grid;
    grid-template-columns: minmax(14rem, 1.5fr) 1fr 1fr 1fr;
    gap: 0.5rem;
    max-width: 64rem;
    align-items: stretch;
    margin-top: 1rem;
  }

  .head {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-secondary);
  }

  .name {
    align-self: center;
  }

  .option {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    font-size: 1.5rem;
    padding: 0.75rem;
    background: var(--surface);
    border: 2px solid transparent;
    border-radius: 0.75rem;
  }

  .option.original {
    background: transparent;
  }

  button.option {
    cursor: pointer;
    color: inherit;
    transition: border-color 150ms;
  }

  button.option.selected {
    border-color: var(--primary);
  }

  .mdi-name {
    font-size: 0.6875rem;
    color: var(--color-secondary);
  }

  .summary {
    margin-top: 1.5rem;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    background: var(--surface);
    padding: 0.75rem;
    border-radius: 0.5rem;
    max-width: 64rem;
  }
</style>
