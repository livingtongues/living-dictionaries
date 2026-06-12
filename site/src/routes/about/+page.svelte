<script lang="ts">
  import { Button } from '$lib/svelte-pieces'
  import { page } from '$app/state'
  import Header from '$lib/components/shell/Header.svelte'
  import Footer from '$lib/components/shell/Footer.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
</script>

<Header>
  {page.data.t('about.about_LD')}
</Header>

<div class="page-column">
  <h3 class="page-title">
    {page.data.t('about.about_LD')}
  </h3>

  <p class="spaced">
    {page.data.t('about.online_tool')}
  </p>
  <p class="spaced">
    {page.data.t('about.promote_connectivity')}
  </p>
  <p class="spaced">
    {page.data.t('about.td_beginnings')}
  </p>

  <hr style="margin: 40px 0;" />

  <h4 class="section-title">
    {page.data.t('about.current_features')}
  </h4>
  <p>
    {page.data.t('about.manage_entries')}
  </p>
  <p>
    {page.data.t('about.record_playback_audio')}
  </p>
  <p>{page.data.t('about.photo_upload')}</p>
  <p>{page.data.t('about.offline_data')}</p>
  <p>{page.data.t('about.search')}</p>
  <p>{page.data.t('about.entry_count')}</p>
  <p>{page.data.t('about.SD')}</p>
  <p>
    {page.data.t('about.private_public')}
  </p>
  <p>
    {page.data.t('about.OSK')}
  </p>
  <p>
    {page.data.t('about.import_data')}
  </p>
  <p>
    {page.data.t('about.video_upload')}
  </p>
  <p>
    {page.data.t('about.export_data')}
  </p>

  <h4 class="section-title" style="margin-top: 0.75rem">
    {page.data.t('about.dev_roadmap')}
  </h4>
  <p>
    {page.data.t('about.import_export')}
  </p>
  <p>{page.data.t('about.geo_tagging')}</p>
  <p>{page.data.t('about.flashcard_view')}</p>
  <p>{page.data.t('about.peer_review')}</p>
  <p>{page.data.t('about.suggestions_from_users')}</p>
  <p>{page.data.t('about.push_notifications')}</p>
  <p>{page.data.t('about.contributor_awards')}</p>

  <hr style="margin: 40px 0;" />

  <img
    class="figure"
    alt="man in front of alphabet and storyboard drawing"
    loading="lazy"
    src="https://lh3.googleusercontent.com/ENct1iLDI3jupgP-g4wK968Y1vMuqwNcYNg1XAwnIwnhsEms_7gyBM3I_a55x8ai61GBk8eY8Cg8QW3Kkw_w=w900"
    srcset="https://lh3.googleusercontent.com/ENct1iLDI3jupgP-g4wK968Y1vMuqwNcYNg1XAwnIwnhsEms_7gyBM3I_a55x8ai61GBk8eY8Cg8QW3Kkw_w=w300 300w, https://lh3.googleusercontent.com/ENct1iLDI3jupgP-g4wK968Y1vMuqwNcYNg1XAwnIwnhsEms_7gyBM3I_a55x8ai61GBk8eY8Cg8QW3Kkw_w=w600 600w, https://lh3.googleusercontent.com/ENct1iLDI3jupgP-g4wK968Y1vMuqwNcYNg1XAwnIwnhsEms_7gyBM3I_a55x8ai61GBk8eY8Cg8QW3Kkw_w=w1200 1200w" />

  <h3 class="section-title" style="margin-bottom: 0.75rem">
    {page.data.t('about.why_document')}
  </h3>
  <p class="spaced">
    {page.data.t('about.language_is_history')}
  </p>
  <p class="spaced">
    {page.data.t('about.important_to_document')}
  </p>

  <img
    class="figure"
    alt="Recording language data"
    loading="lazy"
    src="https://lh3.googleusercontent.com/5vsJJzuYggQZaS50JUs2wuwZMUSM0BaPJHMOJfc83Yy8hvMJrvB3YVRfb9eJTBGqrPbhVEW6pzoAp39S2-pC=w900"
    srcset="https://lh3.googleusercontent.com/5vsJJzuYggQZaS50JUs2wuwZMUSM0BaPJHMOJfc83Yy8hvMJrvB3YVRfb9eJTBGqrPbhVEW6pzoAp39S2-pC=w300 300w, https://lh3.googleusercontent.com/5vsJJzuYggQZaS50JUs2wuwZMUSM0BaPJHMOJfc83Yy8hvMJrvB3YVRfb9eJTBGqrPbhVEW6pzoAp39S2-pC=w600 600w, https://lh3.googleusercontent.com/5vsJJzuYggQZaS50JUs2wuwZMUSM0BaPJHMOJfc83Yy8hvMJrvB3YVRfb9eJTBGqrPbhVEW6pzoAp39S2-pC=w1200 1200w" />

  <h3 class="section-title" style="margin-bottom: 0.75rem">
    {page.data.t('about.what_is_LT')}
  </h3>
  <p class="spaced">
    {page.data.t('about.leading_research')}
  </p>
  <p class="spaced">
    {page.data.t('about.two_decades_experience')}
  </p>

  <img
    class="figure"
    style="margin-top: 0.75rem"
    alt="Recording plant words"
    loading="lazy"
    src="https://lh3.googleusercontent.com/BeaR13dGwglkfGBEJsJ6qytJLHygBpxapv3MRdGRpkvEnYs1nGZ6mJBfdR_FsovtOJvkELc1XgWozG-OlPUD=w900"
    srcset="https://lh3.googleusercontent.com/BeaR13dGwglkfGBEJsJ6qytJLHygBpxapv3MRdGRpkvEnYs1nGZ6mJBfdR_FsovtOJvkELc1XgWozG-OlPUD=w300 300w, https://lh3.googleusercontent.com/BeaR13dGwglkfGBEJsJ6qytJLHygBpxapv3MRdGRpkvEnYs1nGZ6mJBfdR_FsovtOJvkELc1XgWozG-OlPUD=w600 600w, https://lh3.googleusercontent.com/BeaR13dGwglkfGBEJsJ6qytJLHygBpxapv3MRdGRpkvEnYs1nGZ6mJBfdR_FsovtOJvkELc1XgWozG-OlPUD=w1200 1200w" />

  <h3 class="section-title" style="margin-bottom: 0.75rem">
    {page.data.t('about.translators')}
  </h3>
  <ul class="spaced">
    <li>
      <b>{page.data.t('gl.as')}</b>: Palash Nath, Luke Horo, Kapil Medhi, Dr. Seuji
      Sharma, Dr. Gitanjali Bezbaruah, Biren Baruah, Khagendra Nath Medhi, Pranab Sharma, Dhanmani
      Baishya, Chan Mohammad Ali, Rahul Choudhary
    </li>
    <li>
      <b>{page.data.t('gl.bn')}</b>: Sumedha Sengupta, Prof. Arun Ghosh
    </li>
    <li>
      <b>{page.data.t('gl.fr')}</b>: Anna Luisa Daigneault
    </li>
    <li>
      <b>{page.data.t('gl.he')}</b>: Dana Melaver, Daniel Bögre Udell
    </li>
    <li>
      <b>{page.data.t('gl.sw')}</b>: Michael Karani
    </li>
    <li>
      <b>{page.data.t('gl.hi')}</b>: Ashwini Parmar, Luke Horo, Bikram Jora, Prof. K.V.
      Subbarao
    </li>
    <li>
      <b>{page.data.t('gl.or')}</b>: Anup Kumar Kujur, Panchanan Mohanty
    </li>
    <li>
      <b>{page.data.t('gl.pt')}</b>: Crisofia Langa da Camara
    </li>
    <li>
      <b>{page.data.t('gl.ru')}</b>: Denis Tokmashev
    </li>
    <li>
      <b>{page.data.t('gl.sn')}</b>: Reggemore Marongedze
    </li>
    <li>
      <b>{page.data.t('gl.es')}</b>: Anna Luisa Daigneault, Amanda Chao Benbassat,
      Mónica Bonilla Parra
    </li>
    <li>
      <b>{page.data.t('gl.ms')}</b>: Nur Hidayah Binte Sunaryo
    </li>
    <li><b>{page.data.t('gl.zu')}</b>: Mthulisi Ncube</li>
    <li>
      <b>{page.data.t('gl.it')}</b>: Iara Mantenuto
    </li>
    <li><b>{page.data.t('gl.cmn')}</b>: Peng Dong, Joy Wu</li>
    <li><b>{page.data.t('gl.tzm')}</b>: Radia Sami</li>
    <li><b>{page.data.t('gl.vi')}</b>: Huy Phan</li>
    <li><b>{page.data.t('gl.id')}</b>: Yustinus Ghanggo Ate</li>
  </ul>

  <h3 class="section-title" style="margin-bottom: 0.75rem">
    {page.data.t('about.interns')} (Living Tongues Institute)
  </h3>
  <p class="spaced">
    Ashlie Devenney, Thorin Engeseth, Ariel Rabkin-Meyer, Ella Hannon, Cassie Gritton, Peyton A.
    Nesler, Emilie Erbland, Kyra O’Connell, Louis Fillman, Liam Marshall-Butler, Shuangqi (Joy) Wu,
    Catherine Huang, Molly Cutler, Luke Strom, Sydney Louchard, Alexis O'Connor, Cassidy Parong,
    Chloe Bourdon, Sichen (Larry) Lyu, Tali Tukachinsky, Valeria Macias, Evelyn Ho, Barbara Lourenco
    Oliveira Moreira, Adviye Pelin Teberoğlu, Sophie Shields, Anthony James Brandy, Rammi Quah,
    Alexandra Winslade, Gabriela Collaço Horton, Vikram Nagapudi, Sasha Viola Fennimore, Polly
    Vishner, Loren Schneider, Kiasah Izzati, Manuel Aguilera, Maksymilian Rębisz, Rachel Mattie,
    Aarushi Asthana, Akano Johnson, Selena Syrett.
  </p>

  <h3 class="section-title" style="margin-bottom: 0.75rem">
    {page.data.t('about.help_us_launch_more')}
  </h3>
  <p class="spaced">
    {page.data.t('about.with_your_help')}
  </p>
  <Button
    form="filled"
    class="donate-button"
    target="_blank"
    href="https://www.paypal.com/donate?hosted_button_id=QCELFXU8ZGTVC"
    rel="noopener">
    {page.data.t('header.donate')}
  </Button>
</div>

<Footer />

<SeoMetaTags
  title={page.data.t('about.about_LD')}
  description="Living Dictionaries are mobile-friendly web tools that support endangered, under-represented and diasporic languages. Led by community activists around the globe, Living Dictionaries are collaborative multimedia projects that help languages survive for generations to come."
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Tongues Institute for Endangered Languages, Gregory D. S. Anderson" />

<!-- Used to have TOU link here -->
<style>
  img {
    display: block;
    width: 100%;
    height: auto;
  }

  .page-column {
    max-width: 768px;
    margin-left: auto;
    margin-right: auto;
    padding: 0.75rem;
  }

  .page-title {
    margin-bottom: 1.5rem;
    font-size: 1.875rem;
    line-height: 2rem;
    font-weight: 700;
    letter-spacing: -0.025em;
    color: var(--color); /* ≈ gray-900 */
  }

  @media (min-width: 640px) {
    .page-title {
      font-size: 2.25rem;
      line-height: 2.5rem;
    }
  }

  .section-title {
    font-size: 1.5rem;
    line-height: 2rem;
    font-weight: 700;
    color: var(--color); /* ≈ gray-900 */
    letter-spacing: -0.025em;
    margin-bottom: 0.5rem;
  }

  @media (min-width: 640px) {
    .section-title {
      font-size: 1.875rem;
      line-height: 2.25rem;
    }
  }

  .spaced {
    margin-bottom: 0.75rem;
  }

  .figure {
    margin-bottom: 1rem;
  }

  .page-column :global(.donate-button) {
    width: 100%;
    margin-top: 0.75rem;
    margin-bottom: 0.75rem;
  }
</style>
