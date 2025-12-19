<!-- @migration-task Error while migrating Svelte code: `<tr>` cannot be a child of `<table>`. `<table>` only allows these children: `<caption>`, `<colgroup>`, `<tbody>`, `<thead>`, `<tfoot>`, `<style>`, `<script>`, `<template>`. The browser will 'repair' the HTML (by moving, removing, or inserting elements) which breaks Svelte's assumptions about the structure of your components.
https://svelte.dev/e/node_invalid_placement -->
<script lang="ts">
  import { Button } from 'svelte-pieces'
  import vowelTrapezoid from './vowel-trapezoid.gif'

  export let on_ipa_change: (new_value: string) => void
  let activeTable = 'consonants'
  let wrapperEl: HTMLDivElement

  function addSelectedLetter(e) {
    const input_element = wrapperEl.firstElementChild as HTMLInputElement
    if (!input_element) return
    const target = e.target as EventTarget & HTMLDivElement
    if (target.tagName.toLowerCase() === 'span') {
      const letter = target.innerHTML.replace(/◌/g, '')
      const cursorPosition = input_element.selectionEnd
      input_element.value
        = input_element.value.substring(0, cursorPosition)
        + letter
        + input_element.value.substring(cursorPosition)
      input_element.selectionEnd = cursorPosition + letter.length
      on_ipa_change(input_element.value)
    }
  }

  function backSpace() {
    const input_element = wrapperEl.firstElementChild as HTMLInputElement
    if (!input_element) return
    const cursorPosition = input_element.selectionEnd
    input_element.value
      = input_element.value.substring(0, cursorPosition - 1)
      + input_element.value.substring(cursorPosition, input_element.value.length)
    on_ipa_change(input_element.value)
    setTimeout(() => (input_element.selectionEnd = cursorPosition - 1), 50)
  }
</script>

<div bind:this={wrapperEl} class="w-full relative">
  <slot />
</div>

<div class="flex overflow-x-auto md:flex-wrap whitespace-nowrap mb-1">
  <Button form="menu" color="black" class="!pt-0 !pb-1 !px-2 !text-lg" onclick={backSpace}>
    <span class="i-heroicons:backspace-20-solid" />
  </Button>
  <Button
    form="menu"
    size="sm"
    active={activeTable === 'consonants'}
    onclick={() => (activeTable = 'consonants')}>Consonants</Button>
  <Button
    form="menu"
    size="sm"
    active={activeTable === 'vowels'}
    onclick={() => (activeTable = 'vowels')}>Vowels</Button>
  <Button
    form="menu"
    size="sm"
    active={activeTable === 'diacritics'}
    onclick={() => (activeTable = 'diacritics')}>Diacritics</Button>
  <Button
    form="menu"
    size="sm"
    active={activeTable === 'other'}
    onclick={() => (activeTable = 'other')}>Suprasegmentals, Tone</Button>
  <Button
    form="menu"
    size="sm"
    active={activeTable === 'nonPulmonic'}
    onclick={() => (activeTable = 'nonPulmonic')}>Non-pulmonic Consonants</Button>
  <Button
    form="menu"
    size="sm"
    active={activeTable === 'affricates'}
    onclick={() => (activeTable = 'affricates')}>Affricates</Button>
  <Button
    form="menu"
    size="sm"
    active={activeTable === 'coarticulated'}
    onclick={() => (activeTable = 'coarticulated')}>Co-Articulated Consonants</Button>
</div>

<div class="overflow-x-auto" on:click={addSelectedLetter}>
  {#if activeTable === 'consonants'}
    <table cellspacing="0">
      <tr class="consonant-header">
        <td class="rowheader" style="font-size: 15px; padding: 5px"><b>Consonants</b></td>
        <td class="labial" title="Labial" colspan="2">Bilabial</td>
        <td class="labial" title="Labial" colspan="2">Labio-<br />dental</td>
        <td class="coronal" title="Coronal" colspan="2">Dental</td>
        <td class="coronal" title="Coronal" colspan="2">Alveolar</td>
        <td class="coronal" title="Coronal" colspan="2">Post-<br />alveolar</td>
        <td class="coronal" title="Coronal" colspan="2">Retroflex</td>
        <td class="dorsal" title="Dorsal" colspan="2">Alveolo-<br />palatal</td>
        <td class="dorsal" title="Dorsal" colspan="2">Palatal</td>
        <td class="dorsal" title="Dorsal" colspan="2">Velar</td>
        <td class="dorsal" title="Dorsal" colspan="2">Uvular</td>
        <td class="radical" title="Radical" colspan="2">Pharyn-<br />geal</td>
        <td class="radical" title="Radical" colspan="2">Epi-<br />glottal</td>
        <td colspan="2">Glottal</td>
      </tr>
      <tr>
        <td class="rowheader">Nasal</td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless bilabial nasal">m̥</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Bilabial nasal">m</span></td>
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Labiodental nasal">ɱ</span></td>
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Dental nasal">n̪</span></td>
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Voiceless alveolar nasal">n̥</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Alveolar nasal">n</span></td>
        <td class="bt1 br0 bb1 bl0" />
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Postalveolar nasal">n̠</span></td>
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Retroflex nasal">ɳ</span></td>
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Alveolo-palatal nasal">ɲ̟</span></td>
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Voiceless palatal nasal">ɲ̊</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Palatal nasal">ɲ</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless velar nasal">ŋ̊</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Velar nasal">ŋ</span></td>
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Uvular nasal">ɴ</span></td>
        <td colspan="6" class="bt1 br1 bb0 bl1 nd" />
      </tr>
      <tr>
        <td class="rowheader">Stop</td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless bilabial stop">p</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced bilabial stop">b</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless labiodental stop">p̪</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced labiodental stop">b̪</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless dental stop">t̪</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced dental stop">d̪</span></td>
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Voiceless alveolar stop">t</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced alveolar stop">d</span></td>
        <td class="bt1 br1 bb1 bl0" colspan="2">&nbsp;</td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless retroflex stop">ʈ</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced retroflex stop">ɖ</span></td>
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiceless palatal stop">c</span></td>
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Voiced palatal stop">ɟ</span></td>
        <td class="bt1 br1 bb1 bl0" />
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless velar stop">k</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced velar stop">ɡ</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless uvular stop">q</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced uvular stop">ɢ</span></td>
        <td colspan="2" class="bt0 br0 bb1 bl0 nd" />
        <td colspan="2" class="b1"><span class="ipa" title="Epiglottal stop">ʡ</span></td>
        <td class="bt1 br1 bb1 bl1"><span class="ipa" title="Glottal stop">ʔ</span></td>
        <td class="bt0 br1 bb1 bl0 nd" />
      </tr>
      <tr>
        <td class="rowheader">Fricative</td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless bilabial fricative">ɸ</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced bilabial fricative">β</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless labiodental fricative">f</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced labiodental fricative">v</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless dental fricative">θ</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced dental fricative">ð</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless alveolar sibilant">s</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced alveolar sibilant">z</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless palato-alveolar sibilant">ʃ</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced palato-alveolar sibilant">ʒ</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless retroflex sibilant">ʂ</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced retroflex sibilant">ʐ</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless alveolo-palatal sibilant">ɕ</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced alveolo-palatal sibilant">ʑ</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless palatal fricative">ç</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced palatal fricative">ʝ</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless velar fricative">x</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced velar fricative">ɣ</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless uvular fricative">χ</span></td>
        <td rowspan="2" class="bt1 br1 bb1 bl0" style="vertical-align:middle;"><span class="ipa" title="Voiced uvular fricative">ʁ</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless pharyngeal fricative">ħ</span></td>
        <td rowspan="2" class="bt1 br1 bb1 bl0" style="vertical-align:middle;"><span class="ipa" title="Voiced pharyngeal fricative">ʕ</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless epiglottal fricative">ʜ</span></td>
        <td rowspan="2" class="bt1 br1 bb1 bl0" style="vertical-align:middle;"><span class="ipa" title="Voiced epiglottal fricative">ʢ</span></td>
        <td rowspan="2" class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless glottal fricative">h</span></td>
        <td rowspan="2" class="bt1 br1 bb1 bl0" style="vertical-align:middle;"><span class="ipa" title="Voiced glottal fricative">ɦ</span></td>
      </tr>
      <tr>
        <td class="rowheader">Approximant</td>
        <td colspan="2" class="nd" />
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Labiodental approximant">ʋ</span></td>
        <td colspan="2" style="width:3em;" class="bt1 br0 bb1 bl1" />
        <td class="bt1 br0 bb1 bl0" />
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Alveolar approximant">ɹ</span></td>
        <td colspan="2" style="width:3em;" class="bt1 br1 bb1 bl0" />
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Retroflex approximant">ɻ</span></td>
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br0 bb1 bl0" />
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Palatal approximant">j</span></td>
        <td class="bt1 br1 bb1 bl0" />
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Velar approximant">ɰ</span></td>
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br0 bb1 bl1" />
      </tr>
      <tr>
        <td class="rowheader">Flap or tap</td>
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Bilabial flap">ⱱ̟</span></td>
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Labiodental flap">ⱱ</span></td>
        <td colspan="2" style="width:3em;" class="bt1 br0 bb1 bl1" />
        <td class="bt1 br0 bb1 bl0" />
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Alveolar tap">ɾ</span></td>
        <td colspan="2" style="width:3em;" class="bt1 br1 bb1 bl0" />
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Retroflex flap">ɽ</span></td>
        <td colspan="4" class="nd bt0 br0 bb0 bl0" />
        <td colspan="2" class="nd" />
        <td colspan="2" class="bt1 br1 bb1 bl1"><span class="ipa" title="Uvular flap">ɢ̆</span></td>
        <td colspan="2" class="bt1 br1 bb0 bl1 nd" />
        <td class="bt0 br0 bb0 bl1" />
        <td class="bt0 br1 bb1 bl0"><span class="ipa" title="Epiglottal flap">ʡ̯</span></td>
        <td colspan="2" class="bt1 br1 bb0 bl1 nd" />
      </tr>
      <tr>
        <td class="rowheader">Trill</td>
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Bilabial trill">ʙ</span></td>
        <td colspan="2" class="nd" />
        <td colspan="2" class="bt1 br0 bb1 bl1 " />
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Voiceless alveolar trill">r̥</span></td>
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Alveolar trill">r</span></td>
        <td colspan="2" style="width:3em;" class="bt1 br1 bb1 bl0" />
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Retroflex trill">ɽ͡r</span></td>
        <td colspan="4" class="nd" />
        <td colspan="2" class="nd" />
        <td colspan="2" class="bt1 br1 bb1 bl1"><span class="ipa" title="Uvular trill">ʀ</span></td>
        <td colspan="2" class="bt0 br1 bb0 bl1 nd" />
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Epiglottal trill">ᴙ</span></td>
        <td colspan="2" class="bt0 br1 bb0 bl1 nd" />
      </tr>
      <tr>
        <td class="rowheader">Lateral Fric.</td>
        <td colspan="4" class="bt0 br1 bb0 bl1 nd" />
        <td colspan="2" class="bt1 br0 bb1 bl1" />
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Voiceless alveolar lateral fricative">ɬ</span></td>
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Voiced alveolar lateral fricative">ɮ</span></td>
        <td colspan="2" class="bt1 br1 bb1 bl0" />
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless retroflex lateral fricative">ɭ˔̊</span></td>
        <td class="bt1 br1 bb1 bl0" />
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br0 bb1 bl0" />
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Voiceless palatal lateral fricative">ʎ̥˔</span></td>
        <td class="bt1 br1 bb1 bl0" />
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless velar lateral fricative">ʟ̝̊</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced velar lateral fricative">ʟ̝</span></td>
        <td colspan="8" class="bt0 br1 bb0 bl1 nd" />
      </tr>
      <tr>
        <td class="rowheader">Lateral Appr.</td>
        <td colspan="4" class="bt0 br1 bb0 bl1 nd" />
        <td colspan="2" class="bt1 br0 bb1 bl1" />
        <td class="bt1 br0 bb1 bl0" />
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Alveolar lateral approximant">l</span></td>
        <td colspan="2" style="width:3em;" class="bt1 br1 bb1 bl0" />
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Retroflex lateral approximant">ɭ</span></td>
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Lateral alveolo-palatal approximant">ʎ̟</span></td>
        <td class="bt1 br0 bb1 bl0" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Palatal lateral approximant">ʎ</span></td>
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Velar lateral approximant">ʟ</span></td>
        <td colspan="8" class="bt0 br1 bb0 bl1 nd" />
      </tr>
      <tr>
        <td class="rowheader">Lateral flap</td>
        <td colspan="4" class="bt0 br1 bb1 bl1 nd" />
        <td colspan="2" class="bt1 br0 bb1 bl1" />
        <td class="bt1 br0 bb1 bl0" />
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Alveolar lateral flap">ɺ</span></td>
        <td colspan="2" class="bt1 br1 bb1 bl0" />
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Retroflex lateral flap">ɺ̠</span></td>
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br0 bb1 bl0" />
        <td class="bt1 br0 bb1 bl0"><span class="ipa" title="Palatal lateral flap">ʎ̯</span></td>
        <td class="bt1 br1 bb1 bl0" />
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Velar lateral flap">ʟ̆</span></td>
        <td colspan="8" class="bt0 br1 bb1 bl1 nd" />
      </tr>
    </table>
  {/if}

  {#if activeTable === 'vowels'}
    <table class="vowels" cellspacing="0" style="border:1px solid #aaa;">
      <tr class="vowelheader">
        <td style="font-size: 15px; padding: 3px"><b>Vowels</b></td>
        <td style="width: 85px">
          <span style="" title="Front vowel">Front</span>
        </td>
        <td style="line-height: 100%" title="Near-front vowel">Near<br />front</td>
        <td style="" title="Central vowel">Central</td>
        <td style="line-height:100%" title="Near-back vowel">Near<br />back</td>
        <td style="" title="Back vowel">Back</td>
      </tr>
      <tr>
        <td class="rowheader" style="height:36.5px; text-align:right;" title="Close vowel"><b>Close</b></td>
        <td rowspan="7" colspan="5" style="font-size: 80%; padding: 15px 30px 15px 17px;">
          <div style="position:relative;">
            <img
              width="320"
              height="224"
              style="position:relative; margin-left: 5px; max-width: unset;"
              src={vowelTrapezoid}
              alt="" />
            <div style="position:absolute; top:-20px;">
              <table
                style="position:relative; width:300px; height:224px; text-align:left; font-size:131%;">
                <tr>
                  <td style="vertical-align: top;">
                    <div class="vowel_row">
                      <span style="left:-13px;"><span class="ipa" title="Close front unrounded vowel">i</span>•<span
                        class="ipa"
                        title="Close front rounded vowel">y</span></span>
                      <span style="left:145px;"><span class="ipa" title="Close central unrounded vowel">ɨ</span>•<span
                        class="ipa"
                        title="Close central rounded vowel">ʉ</span></span>
                      <span style="left:294px;"><span class="ipa" title="Close back unrounded vowel">ɯ</span>•<span
                        class="ipa"
                        title="Close back rounded vowel">u</span></span>
                    </div>
                    <div class="vowel_row">
                      <span style="left:78px;"><span class="ipa" title="Near-close near-front unrounded vowel">ɪ</span>•<span class="ipa" title="Near-close near-front rounded vowel">ʏ</span></span>
                      <span style="left:157px;"><span class="ipa" title="Near-close central unrounded vowel">ɪ̈</span>•<span
                        class="ipa"
                        title="Near-close central rounded vowel">ʊ̈</span></span>
                      <span style="left:257px;"><span class="ipa" title="Near-close near-back vowel">ʊ</span></span>
                    </div>
                    <div class="vowel_row">
                      <span style="left:33px;"><span class="ipa" title="Close-mid front unrounded vowel">e</span>•<span
                        class="ipa"
                        title="Close-mid front rounded vowel">ø</span></span>
                      <span style="left:168px;"><span class="ipa" title="Close-mid central unrounded vowel">ɘ</span>•<span
                        class="ipa"
                        title="Close-mid central rounded vowel">ɵ</span></span>
                      <span style="left:301px;"><span class="ipa" title="Close-mid back unrounded vowel">ɤ</span>•<span
                        class="ipa"
                        title="Close-mid back rounded vowel">o</span></span>
                    </div>
                    <div class="vowel_row">
                      <span style="left:61px;"><span class="ipa" title="Mid front unrounded vowel">e̞</span>•<span
                        class="ipa"
                        title="Mid front rounded vowel">ø̞</span></span>
                      <span style="left:191px;"><span class="ipa" title="Mid-central vowel">ə</span></span>
                      <span style="left:300px;"><span class="ipa" title="Mid back unrounded vowel">ɤ̞</span>•<span
                        class="ipa"
                        title="Mid back rounded vowel">o̞</span></span>
                    </div>
                    <div class="vowel_row">
                      <span style="left:88px;"><span class="ipa" title="Open-mid front unrounded vowel">ɛ</span>•<span
                        class="ipa"
                        title="Open-mid front rounded vowel">œ</span></span>
                      <span style="left:194px;"><span class="ipa" title="Open-mid central unrounded vowel">ɜ</span>•<span
                        class="ipa"
                        title="Open-mid central rounded vowel">ɞ</span></span>
                      <span style="left:300px;"><span class="ipa" title="Open-mid back unrounded vowel">ʌ</span>•<span
                        class="ipa"
                        title="Open-mid back rounded vowel">ɔ</span></span>
                    </div>
                    <div class="vowel_row">
                      <span style="left:114px;"><span class="ipa" title="Near-open front unrounded vowel">æ</span></span>
                      <span style="left:215px;"><span class="ipa" title="Near-open central vowel">ɐ</span></span>
                    </div>
                    <div class="vowel_row">
                      <span style="left:141px;"><span class="ipa" title="Open front unrounded vowel">a</span>•<span
                        class="ipa"
                        title="Open front rounded vowel">ɶ</span></span>
                      <span style="left:229px;"><span class="ipa" title="Open central unrounded vowel">ä</span></span>
                      <span style="left:301px;"><span class="ipa" title="Open back unrounded vowel">ɑ</span>•<span
                        class="ipa"
                        title="Open back rounded vowel">ɒ</span></span>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </div>
        </td>
      </tr>
      <tr>
        <td class="rowheader" style="height:36.5px;" title="Near-close vowel">Near-close</td>
      </tr>
      <tr>
        <td class="rowheader" style="height:36.5px;" title="Close-mid vowel">Close-mid</td>
      </tr>
      <tr>
        <td class="rowheader" style="height:36.5px;" title="Mid vowel"><b>Mid</b></td>
      </tr>
      <tr>
        <td class="rowheader" style="height:36.5px;" title="Open-mid vowel">Open-mid</td>
      </tr>
      <tr>
        <td class="rowheader" style="height:36.5px;" title="Near-open vowel">Near-open</td>
      </tr>
      <tr>
        <td class="rowheader" style="height:36.5px;" title="Open vowel"><b>Open</b></td>
      </tr>
    </table>
  {/if}

  {#if activeTable === 'diacritics'}
    <table cellpadding="3" cellspacing="0" style="float:left;">
      <tr>
        <th colspan="4">Diacritics</th>
      </tr>
      <tr>
        <td class="rowheader">Aspirated</td>
        <td><span class="ipa">◌ʰ</span></td>
        <td class="rowheader">Breathy</td>
        <td class="br1"><span class="ipa">◌̤</span></td>
      </tr>
      <tr>
        <td class="rowheader">Labialised</td>
        <td><span class="ipa">ʷ</span></td>
        <td class="rowheader">Dental</td>
        <td class="br1"><span class="ipa">◌̪</span></td>
      </tr>
      <tr>
        <td class="rowheader">Palatalised</td>
        <td><span class="ipa">ʲ</span></td>
        <td class="rowheader">Apical</td>
        <td class="br1"><span class="ipa">◌̺</span></td>
      </tr>
      <tr>
        <td class="rowheader">Velarised</td>
        <td><span class="ipa">ˠ</span></td>
        <td class="rowheader">Laminal</td>
        <td class="br1"><span class="ipa">◌̻</span></td>
      </tr>
      <tr>
        <td class="rowheader">Pharyngealised</td>
        <td><span class="ipa">ˤ</span></td>
        <td class="rowheader">Linguo-labial</td>
        <td class="br1"><span class="ipa">◌̼</span></td>
      </tr>
      <tr>
        <td class="rowheader">Nasalised</td>
        <td><span class="ipa">◌̃</span></td>
        <td class="rowheader">Double artic./<br />affricate</td>
        <td class="br1"><span class="ipa">◌͡◌</span></td>
      </tr>
      <tr>
        <td class="rowheader">Pre/post <br />nasalised</td>
        <td><span class="ipa">ⁿ</span></td>
        <td class="rowheader">Lateral release</td>
        <td class="br1"><span class="ipa">ˡ</span></td>
      </tr>
      <tr>
        <td class="rowheader">Centralised</td>
        <td><span class="ipa">◌̈</span></td>
        <td class="rowheader">Mid centralised</td>
        <td class="br1"><span class="ipa">◌̽</span></td>
      </tr>
      <tr>
        <td class="rowheader">Velar/<br />Pharyngealised</td>
        <td><span class="ipa">ɫ</span></td>
        <td class="rowheader">Advanced</td>
        <td class="br1"><span class="ipa">◌̟</span></td>
      </tr>
      <tr>
        <td class="rowheader">Rhoticity</td>
        <td><span class="ipa">◌˞</span></td>
        <td class="rowheader">Retracted</td>
        <td class="br1"><span class="ipa">◌̠</span></td>
      </tr>
      <tr>
        <td class="rowheader">Ejective</td>
        <td><span class="ipa">◌ʼ</span></td>
        <td class="rowheader">Raised</td>
        <td class="br1"><span class="ipa">◌̝</span></td>
      </tr>
      <tr>
        <td class="rowheader">Unreleased</td>
        <td><span class="ipa">◌̚</span></td>
        <td class="rowheader">Lowered</td>
        <td class="br1"><span class="ipa">◌̞</span></td>
      </tr>
      <tr>
        <td class="rowheader">Syllabic</td>
        <td><span class="ipa">◌̩</span></td>
        <td class="rowheader">+ATR</td>
        <td class="br1"><span class="ipa">◌̘</span></td>
      </tr>
      <tr>
        <td class="rowheader">Non-syllabic</td>
        <td><span class="ipa">◌̯</span></td>
        <td class="rowheader">-ATR</td>
        <td class="br1"><span class="ipa">◌̙</span></td>
      </tr>
      <tr>
        <td class="rowheader">Creaky</td>
        <td><span class="ipa">◌̰</span></td>
        <td class="rowheader">More rounded</td>
        <td class="br1"><span class="ipa">◌̹</span></td>
      </tr>
      <tr>
        <td class="rowheader">Voiceless</td>
        <td><span class="ipa">◌̥</span></td>
        <td class="rowheader">Less rounded</td>
        <td class="br1 bb1"><span class="ipa">◌̜</span></td>
      </tr>
      <tr>
        <td class="rowheader">Voiced</td>
        <td class="br1 bb1"><span class="ipa">◌̬</span></td>
        <td />
        <td />
      </tr>
    </table>
  {/if}

  {#if activeTable === 'other'}
    <table cellpadding="3" cellspacing="0" style="float:left;">
      <tr>
        <th class="align-middle" colspan="2" rowspan="1">Suprasegmentals</th>
        <th colspan="2" rowspan="1" style="line-height:100%">Diacritic<br />tone marks</th>
        <th colspan="2" rowspan="1" style="line-height:100%">Tone&nbsp;Letters<br />&amp; Numbers</th>
      </tr>
      <tr>
        <td class="rowheader">Long</td>
        <td><span class="ipa">◌ː</span></td>
        <td class="rowheader">Extra high<br />tone</td>
        <td><span class="ipa">◌̋</span></td>
        <td class="rowheader">Extra low<br />tone</td>
        <td class="br1"><span class="ipa">˩</span></td>
      </tr>
      <tr>
        <td class="rowheader">Half long</td>
        <td><span class="ipa">◌ˑ</span></td>
        <td class="rowheader">High tone</td>
        <td><span class="ipa">◌́</span></td>
        <td class="rowheader">Low tone</td>
        <td class="br1"><span class="ipa">˨</span></td>
      </tr>
      <tr>
        <td class="rowheader">Extra long</td>
        <td><span class="ipa">ːː</span></td>
        <td class="rowheader">Mid tone</td>
        <td><span class="ipa">◌̄</span></td>
        <td class="rowheader">Mid tone</td>
        <td class="br1"><span class="ipa">˧</span></td>
      </tr>
      <tr>
        <td class="rowheader bdashed">Extra short</td>
        <td><span class="ipa">◌̆</span></td>
        <td class="rowheader">Low tone</td>
        <td><span class="ipa">◌̀</span></td>
        <td class="rowheader">High tone</td>
        <td class="br1"><span class="ipa">˦</span></td>
      </tr>
      <tr>
        <td class="rowheader">Primary<br />stress</td>
        <td><span class="ipa">ˈ</span></td>
        <td class="rowheader">Extra low<br />tone</td>
        <td><span class="ipa">◌̏</span></td>
        <td class="rowheader">Extra high<br />tone</td>
        <td class="br1"><span class="ipa">˥</span></td>
      </tr>
      <tr>
        <td class="rowheader bdashed">Secondary<br />stress</td>
        <td><span class="ipa">ˌ</span></td>
        <td class="rowheader">Falling tone</td>
        <td><span class="ipa">◌̂</span></td>
        <td class="rowheader">Rising tone</td>
        <td class="br1"><span class="ipa">˩˥</span></td>
      </tr>
      <tr>
        <td class="rowheader">Syllable<br />break</td>
        <td><span class="ipa">.</span></td>
        <td class="rowheader bdashed">Rising tone</td>
        <td class="bb1"><span class="ipa">◌̌</span></td>
        <td class="rowheader">Falling tone</td>
        <td class="br1"><span class="ipa">˥˩</span></td>
      </tr>
      <tr>
        <td class="rowheader">Minor group:<br />foot</td>
        <td class="br1"><span class="ipa">|</span></td>
        <td />
        <td />
        <td class="rowheader">Low rising<br />tone</td>
        <td class="br1"><span class="ipa">˩˧</span></td>
      </tr>
      <tr>
        <td class="rowheader">Major group</td>
        <td class="br1"><span class="ipa">‖</span></td>
        <td />
        <td />
        <td class="rowheader">Low falling<br />tone</td>
        <td class="br1"><span class="ipa">˧˩</span></td>
      </tr>
      <tr>
        <td class="rowheader bdashed">Linking -<br />no break</td>
        <td class="br1"><span class="ipa">‿</span></td>
        <td />
        <td />
        <td class="rowheader">High falling<br />tone</td>
        <td class="br1"><span class="ipa">˥˧</span></td>
      </tr>
      <tr>
        <td class="rowheader">Rising<br />intonation</td>
        <td class="br1"><span class="ipa">↗</span></td>
        <td />
        <td />
        <td class="rowheader">High rising<br />tone</td>
        <td class="br1"><span class="ipa">˧˥</span></td>
      </tr>
      <tr>
        <td class="rowheader bdashed">Falling<br />intonation</td>
        <td class="br1"><span class="ipa">↘</span></td>
        <td />
        <td />
        <td colspan="2" class="rowheader" style="text-align: left">Superscripts</td>
      </tr>
      <tr>
        <td class="rowheader">Downstep</td>
        <td class="br1"><span class="ipa">↓</span></td>
        <td />
        <td />
        <td
          rowspan="2"
          colspan="2"
          class="bl1 br1"
          style="width:100px;border-bottom:1px solid #aaa;">
          <span class="ipa">⁰</span>
          <span class="ipa">¹</span>
          <span class="ipa">²</span>
          <span class="ipa">³</span>
          <span class="ipa">⁴</span>
          <span class="ipa">⁵</span>
          <span class="ipa">⁶</span>
          <span class="ipa">⁷</span>
          <span class="ipa">⁸</span>
          <span class="ipa">⁹</span>
          <span class="ipa">⁻</span>
        </td>
      </tr>
      <tr>
        <td class="rowheader">Upstep</td>
        <td class="br1 bb1"><span class="ipa">↑</span></td>
        <td />
        <td />
      </tr>
    </table>
  {/if}

  {#if activeTable === 'nonPulmonic'}
    <table cellspacing="0" style="float: left;">
      <tr>
        <th colspan="8">Non-pulmonic consonants</th>
      </tr>
      <tr>
        <td rowspan="2" class="rowheader">Clicks</td>
        <td class="bt0 br1 bb1 bl1" title="Bilabial clicks"><span class="ipa">ʘ</span></td>
        <td class="bt0 br1 bb1 bl1" title="Dental clicks"><span class="ipa">ǀ</span></td>
        <td class="bt0 br1 bb1 bl1" colspan="2" title="Alveolar clicks"><span class="ipa">ǃ</span></td>
        <td class="bt0 br1 bb1 bl1" colspan="2" title="Palatal clicks"><span class="ipa">ǂ</span></td>
        <td class="bt0 br1 bb1 bl1" title="Lateral clicks"><span class="ipa">ǁ</span></td>
      </tr>
      <tr>
        <td class="bt0 br1 bb1 bl1" title="Nasal clicks"><span class="ipa">ʘ̃</span></td>
        <td class="bt0 br1 bb1 bl1" title="Glottalized clicks"><span class="ipa">ʘ̃ˀ</span></td>
        <td class="bt0 br1 bb1 bl1" colspan="2" title="Pulmonic-contour clicks"><span class="ipa">ʘ͡q</span></td>
        <td class="bt0 br1 bb1 bl1" colspan="2" title="Ejective-contour clicks"><span class="ipa">ʘ͡qʼ</span></td>
        <td class="bt0 br1 bb1 bl1" title="Retroflex clicks"><span class="ipa">‼</span></td>
      </tr>
      <tr>
        <td class="rowheader">Implosives</td>
        <td class="b1"><span class="ipa" title="Voiced bilabial implosive">ɓ</span></td>
        <td class="b1"><span class="ipa" title="Voiced alveolar implosive">ɗ</span></td>
        <td class="b1"><span class="ipa" title="Voiced palatal implosive">ʄ</span></td>
        <td class="b1"><span class="ipa" title="Voiced retroflex implosive">ᶑ</span></td>
        <td class="b1" colspan="2"><span class="ipa" title="Voiced velar implosive">ɠ</span></td>
        <td class="b1"><span class="ipa" title="Voiced uvular implosive">ʛ</span></td>
      </tr>
      <tr>
        <td class="rowheader" rowspan="3">Ejectives</td>
        <td class="b1"><span class="ipa" title="Bilabial ejective">pʼ</span></td>
        <td class="b1"><span class="ipa" title="Alveolar ejective">tʼ</span></td>
        <td class="b1"><span class="ipa" title="Palatal ejective">cʼ</span></td>
        <td class="b1"><span class="ipa" title="Retroflex ejective">ʈʼ</span></td>
        <td class="b1" colspan="2"><span class="ipa" title="Velar ejective">kʼ</span></td>
        <td class="b1"><span class="ipa" title="Uvular ejective">qʼ</span></td>
      </tr>
      <tr>
        <td class="b1"><span class="ipa" title="Labiodental ejective fricative">fʼ</span></td>
        <td class="b1"><span class="ipa" title="Dental ejective fricative">θʼ</span></td>
        <td class="b1"><span class="ipa" title="Alveolar ejective fricative">sʼ</span></td>
        <td class="b1"><span class="ipa" title="Alveolar lateral ejective fricative">ɬʼ</span></td>
        <td class="b1" colspan="2"><span class="ipa" title="Velar ejective fricative">xʼ</span></td>
        <td class="b1"><span class="ipa" title="Uvular ejective fricative">χʼ</span></td>
      </tr>
      <tr>
        <td class="b1"><span class="ipa" title="Alveolar ejective affricate">tsʼ</span></td>
        <td class="b1"><span class="ipa" title="Alveolar lateral ejective affricate">tɬʼ</span></td>
        <td class="b1"><span class="ipa" title="Palatal lateral ejective affricate">cʎ̝̥ʼ</span></td>
        <td class="b1"><span class="ipa" title="Palato-alveolar ejective affricate">tʃʼ</span></td>
        <td class="b1"><span class="ipa" title="Retroflex ejective affricate">ʈʂʼ</span></td>
        <td class="b1"><span class="ipa" title="Velar ejective affricate">kxʼ</span></td>
        <td class="b1"><span class="ipa" title="Velar lateral ejective affricate">kʟ̝̊ʼ</span></td>
      </tr>
    </table>
  {/if}

  {#if activeTable === 'affricates'}
    <table cellspacing="0" style="float: left;">
      <tr>
        <th colspan="10">Affricates</th>
      </tr>
      <tr>
        <td class="bt0 br0 bb0 bl1"><span class="ipa" title="Voiceless labiodental affricate">p̪f</span></td>
        <td class="bt0 br1 bb0 bl0"><span class="ipa" title="Voiced labiodental affricate">b̪v</span></td>
        <td class="bt0 br0 bb0 bl1"><span class="ipa" title="Voiceless alveolar affricate">ts</span></td>
        <td class="bt0 br1 bb0 bl0"><span class="ipa" title="Voiced alveolar affricate">dz</span></td>
        <td class="bt0 br0 bb0 bl1"><span class="ipa" title="Voiceless palato-alveolar affricate">tʃ</span></td>
        <td class="bt0 br1 bb0 bl0"><span class="ipa" title="Voiced palato-alveolar affricate">dʒ</span></td>
        <td class="bt0 br0 bb0 bl1"><span class="ipa" title="Voiceless alveolo-palatal affricate">tɕ</span></td>
        <td class="bt0 br1 bb0 bl0"><span class="ipa" title="Voiced alveolo-palatal affricate">dʑ</span></td>
        <td class="bt0 br0 bb0 bl1"><span class="ipa" title="Voiceless retroflex affricate">ʈʂ</span></td>
        <td class="bt0 br1 bb0 bl0"><span class="ipa" title="Voiced retroflex affricate">ɖʐ</span></td>
      </tr>
      <tr>
        <td class="bt1 br0 bb1 bl1" />
        <td class="bt1 br1 bb1 bl0" />
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless alveolar lateral affricate">tɬ</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced alveolar lateral affricate">dɮ</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless palatal affricate">cç</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced palatal affricate">ɟʝ</span></td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless palatal lateral affricate">cʎ̥˔</span></td>
        <td class="bt1 br1 bb1 bl0" />
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless velar lateral affricate">kʟ̝̊</span></td>
        <td class="bt1 br1 bb1 bl0" />
      </tr>
    </table>
  {/if}

  {#if activeTable === 'coarticulated'}
    <table cellspacing="0" width="225">
      <tr>
        <th colspan="5">Co-articulated consonants</th>
      </tr>
      <tr>
        <td class="rowheader">Continuants</td>
        <td class="bt0 br0 bb1 bl1"><span class="ipa" title="Voiceless labio-velar approximant">ʍ</span></td>
        <td class="bt0 br1 bb1 bl0"><span class="ipa" title="Labio-velar approximant">w</span></td>
        <td class="bt0 br1 bb1 bl1"><span class="ipa" title="Labial-palatal approximant">ɥ</span></td>
        <td class="bt0 br1 bb1 bl0"><span class="ipa" title="Sj-sound">ɧ</span></td>
      </tr>
      <tr>
        <td class="rowheader">Occlusives</td>
        <td class="bt1 br0 bb1 bl1"><span class="ipa" title="Voiceless labial-velar stop">k͡p</span></td>
        <td class="bt1 br1 bb1 bl0"><span class="ipa" title="Voiced labial-velar stop">ɡ͡b</span></td>
        <td class="b1" colspan="2"><span class="ipa" title="Labial-velar nasal">ŋ͡m</span></td>
      </tr>
    </table>
  {/if}
</div>

<style>
  .b1 {
    border: 1px solid #aaa;
  }
  .bt0,
  .br0,
  .bb0,
  .bl0,
  .bt1,
  .br1,
  .bb1,
  .bl1 {
    border-style: solid;
    border-color: #aaa;
    border-collapse: collapse;
  }
  .bt0 {
    border-top-width: 0px;
  }
  .br0 {
    border-right-width: 0px;
  }
  .bb0 {
    border-bottom-width: 0px;
  }
  .bl0 {
    border-left-width: 0px;
  }
  .bt1 {
    border-top-width: 1px;
  }
  .br1 {
    border-right-width: 1px;
  }
  .bb1 {
    border-bottom-width: 1px;
  }
  .bl1 {
    border-left-width: 1px;
  }

  table {
    text-align: center;
    vertical-align: bottom;
    border-collapse: collapse;
    margin: 0em 1em 1em 0;
    float: left;
  }
  .nd {
    background-color: #ccc;
  }
  td {
    padding: 0;
    margin: 0;
  }
  th {
    font-size: 14px;
    text-align: center;
    padding: 5px 10px;
    border: 1px solid #aaa;
    font-weight: bold;
    font-family: 'Trebuchet MS', Arial, sans-serif;
    background: #64b0ff;
  }
  tr {
    line-height: 170%;
  }
  span.ipa {
    padding: 5px;
    font-size: 110%;
    line-height: 25px;
  }
  span.ipa:hover {
    display: inline-block;
    cursor: pointer;
    background-color: rgb(238, 238, 238);
    transform: scale(1.75, 1.75);
    line-height: 9px;
    border-radius: 3px;
    padding: 3px 5px 7px;
  }
  .vowels .ipa {
    position: relative;
  }
  .vowel_row {
    height: 36.5px;
    width: 350px;
    position: relative;
  }
  div.vowel_row > span {
    background-color: white;
    line-height: 12px;
    position: absolute;
    padding: 0;
    top: 8px;
  }

  .rowheader {
    text-align: right;
    padding: 0 5px;
    border: 1px solid #aaa;
    font-size: 12px;
    font-family: 'Trebuchet MS', Arial, sans-serif;
    background-color: #c9e1fa;
    line-height: 100%;
    word-wrap: normal;
  }

  .vowelheader td {
    background-color: #a4caf2;
    border: 1px solid #aaa;
    font-family: 'Trebuchet MS', Arial, sans-serif;
    font-size: 12px;
  }

  .labial {
    background: rgb(255, 230, 230);
  }
  .coronal {
    background: rgb(244, 255, 230);
  }
  .dorsal {
    background: rgb(230, 234, 255);
  }
  .radical {
    background: rgb(230, 255, 240);
  }

  .consonant-header td {
    border-top: 1px solid #aaa;
    border-right: 1px solid #aaa;
    padding: 1px;
    font-family: 'Trebuchet MS', Arial, sans-serif;
    font-size: 11px;
    text-align: center;
    line-height: 100%;
  }
</style>
