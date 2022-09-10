<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Header from '$lib/components/shell/Header.svelte';
</script>

<svelte:head>
  <title>
    {$_('header.tutorials', { default: 'Tutorials' })}
  </title>
</svelte:head>

<Header>
  {$_('header.tutorials', { default: 'Tutorials' })}
</Header>

<div class="max-w-screen-md mx-auto p-3">
  <iframe
    class="video mb-3"
    src="https://www.youtube.com/embed/d8neBgRsTrI"
    title="Tutorial 1 - How to create an account and a new Living Dictionary"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen />
    
    <iframe
    class="video mb-3"
    src="https://www.youtube.com/embed/Mm2-LwKySn8"
    title="Seminario 1 - Como iniciar una cuenta y crear un Diccionario Vivo"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen />
</div>

<style>
  .video {
    aspect-ratio: 16 / 9;
    width: 100%;
  }
</style>
