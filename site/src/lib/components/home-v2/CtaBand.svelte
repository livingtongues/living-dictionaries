<script lang="ts">
  import { page } from '$app/state'
  import IconMdiPlus from '~icons/mdi/plus'
  import IconMdiFormatListBulleted from '~icons/mdi/format-list-bulleted'

  const t = $derived(page.data.t)
</script>

<section class="cta">
  <h2>{t('home_v2.cta_heading')}</h2>
  <div class="actions">
    <a href="/create-dictionary" class="btn-primary btn-lg" style="gap: 0.5rem">
      <IconMdiPlus /> {t('create.create_new_dictionary')}
    </a>
    <a href="/dictionaries" class="btn-outline btn-lg" style="gap: 0.5rem">
      <IconMdiFormatListBulleted /> {t('home.list_of_dictionaries')}
    </a>
  </div>
</section>

<style>
  .cta {
    max-width: 72rem;
    margin: 0 auto;
    padding: 3rem 1rem 3.5rem;
    text-align: center;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 1.5rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.75rem;
  }
</style>
