<script lang="ts">
  import { page } from '$app/state'
</script>

<ul>
  <li>{page.data.t('about.question_1')}</li>
  <li>{page.data.t('about.question_2')}</li>
  <li>{page.data.t('about.question_3')}</li>
  <li>{page.data.t('about.question_4')}</li>
  <li>{page.data.t('about.question_5')}</li>
</ul>

<style>
  ul {
    list-style-type: disc;
    padding-left: 1.25rem;
    line-height: 1.5;
  }

  li {
    margin-bottom: 0.25rem;
  }
</style>
