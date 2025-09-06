<script lang="ts">
  import { page } from '$app/stores'
  import Header from '$lib/components/shell/Header.svelte'
  import Footer from '$lib/components/shell/Footer.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
</script>

<Header>
  {$page.data.t('header.tutorials')}
</Header>

<div class="max-w-screen-md mx-auto p-3">
  <h2 class="font-semibold">Project overview</h2>
  <iframe
    class="video mb-3"
    src="https://www.youtube.com/embed/fkD-p5Kgefw?si=Q1uKakhwGiicfibB"
    title="Project overview"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen />
</div>

<div class="max-w-screen-md mx-auto p-3">
  <h2 class="font-semibold">English tutorials</h2>
  <iframe
    class="video mb-3"
    src="https://www.youtube.com/embed/d8neBgRsTrI"
    title="Tutorial 1 - How to create an account and a new Living Dictionary"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen />

  <iframe
    class="video mb-3"
    src="https://www.youtube.com/embed/4PRGtToFhgo"
    title="Tutorial 2 - How to Add and Edit Entries in a Living Dictionary"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen />
</div>

<div class="max-w-screen-md mx-auto p-3">
  <h2 class="font-semibold">Tutoriales en español</h2>
  <iframe
    class="video mb-3"
    src="https://www.youtube.com/embed/Mm2-LwKySn8"
    title="Seminario 1 - Como iniciar una cuenta y crear un Diccionario Vivo"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen />

  <iframe
    class="video mb-3"
    src="https://www.youtube.com/embed/opQtwmxEFGc"
    title="Seminario 2 - Como agregar y editar entradas en un Diccionario Vivo"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen />
</div>

<Footer />

<SeoMetaTags
  title={$page.data.t('header.tutorials')}
  type="video"
  description="We offer video tutorials narrated in English and Spanish for dictionary managers seeking to learn how to create a Living Dictionary on the platform, as well as how to add entries with multimedia. Living Dictionaries are language documentation tools that support endangered and under-represented languages. This online platform was created by Living Tongues Institute for Endangered Languages as a free multimedia resource for community activists and linguists who want to build digital dictionaries and phrasebooks."
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Tutorials, Lesson, Seminarios, Videos, Masterclass" />

<style>
  .video {
    aspect-ratio: 16 / 9;
    width: 100%;
  }
</style>
