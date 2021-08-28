<script context="module" lang="ts">
  declare const window: any;
</script>

<script lang="ts">
  import './keyman.css';

  import { onMount } from 'svelte';

  let glossLanguages = {
    sq: {
      vernacularName: 'gjuha shqipe',
    },
    am: {
      vernacularName: 'አማርኛ',
      vernacularAlternate: 'Amarəñña',
      internalName: 'gff_amharic',
      showKeyboard: true,
    },
    ar: {
      vernacularName: 'العَرَبِيَّة‎',
      internalName: 'sil_arabic_phonetic',
      showKeyboard: true,
    },
    hy: {
      vernacularName: 'Հայերէն',
    },
    as: {
      vernacularName: 'অসমীয়া',
      vernacularAlternate: 'Asamiya',
      internalName: 'isis_bangla',
      showKeyboard: true,
    },
    av: {
      vernacularName: 'Магӏарул мацӏ ',
      vernacularAlternate: 'Авар мацӏ',
    },
    ay: {
      vernacularName: 'Aymar aru',
      internalName: 'european2',
    },
  };

  export let value = '',
    languages: string[] = [],
    currentLanguage: string;

  let el: HTMLInputElement;

  onMount(async () => {
    await window.keyman.init({
      attachType: 'manual', // auto
    });

    console.log(window.keyman.util.isTouchDevice());
    if (!window.keyman.util.isTouchDevice()) {
      document.body.classList.add('kmw-is-desktop');
    }

    for (const language of languages) {
      const internalName = glossLanguages[language] && glossLanguages[language].internalName;
      const keyboard = (internalName && `${internalName}@${language}`) || `@${language}`;

      window.keyman.addKeyboards(keyboard); //https://help.keyman.com/DEVELOPER/engine/web/13.0/reference/core/addKeyboards
      window.keyman.attachToControl(el);
      if (internalName && language === currentLanguage) {
        window.keyman.setKeyboardForControl(el, internalName, language);
        // https://help.keyman.com/DEVELOPER/engine/web/13.0/reference/core/setKeyboardForControl
      }
    }

    // const version = "15.0.18";
    // const script = document.createElement("script");
    // const scriptButton = document.createElement("script");
    // script.src = `https://s.keyman.com/kmw/engine/${version}/keymanweb.js`;
    // scriptButton.src = `https://s.keyman.com/kmw/engine/${version}/kmwuibutton.js`; //button.js`;

    // script.onload = () => {
    //     scriptButton.onload = async () => {
    //         console.log(window.keyman);
    //         await window.keyman.init({
    //             attachType: "auto",
    //             root: "./hello",
    //             // ui: 'button',
    //         });
    //         window.keyman.addKeyboards("@th"); // Thai keyboard
    //         window.keyman.addKeyboards("@en"); // English keyboard
    //     };
    //     document.head.appendChild(scriptButton);
    // };
    // document.head.appendChild(script);

    // return () => {
    //     script && script.parentNode.removeChild(script);
    //     scriptButton && scriptButton.parentNode.removeChild(scriptButton);
    // };
  });
</script>

<div>Keyman:</div>

<!-- <div><div id="KeymanWebControl"></div></div> -->

<div class="flex items-center my-2">
  <input bind:this={el} class="border shadow px-3 py-1 block mr-1" bind:value />

  <div id="KeymanWebControl" />
</div>
