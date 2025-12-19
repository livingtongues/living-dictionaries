<script lang="ts">
  import { Button } from 'svelte-pieces'
  import { page } from '$app/stores'
  import Header from '$lib/components/shell/Header.svelte'
  import Footer from '$lib/components/shell/Footer.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
</script>

<Header>
  {$page.data.t('about.about_LD')}
</Header>

<div class="max-w-screen-md mx-auto p-3">
  <h3
    class="mb-6 text-3xl leading-8 font-bold tracking-tight text-gray-900
      sm:text-4xl sm:leading-10">
    {$page.data.t('about.about_LD')}
  </h3>

  <p class="mb-3">
    {$page.data.t('about.online_tool')}
  </p>
  <p class="mb-3">
    {$page.data.t('about.promote_connectivity')}
  </p>
  <p class="mb-3">
    {$page.data.t('about.td_beginnings')}
  </p>

  <hr style="margin: 40px 0;" />

  <h4
    class="text-2xl leading-8 font-bold text-gray-900 tracking-tight
      sm:text-3xl sm:leading-9 mb-2">
    {$page.data.t('about.current_features')}
  </h4>
  <p>
    {$page.data.t('about.manage_entries')}
  </p>
  <p>
    {$page.data.t('about.record_playback_audio')}
  </p>
  <p>{$page.data.t('about.photo_upload')}</p>
  <p>{$page.data.t('about.offline_data')}</p>
  <p>{$page.data.t('about.search')}</p>
  <p>{$page.data.t('about.entry_count')}</p>
  <p>{$page.data.t('about.SD')}</p>
  <p>
    {$page.data.t('about.private_public')}
  </p>
  <p>
    {$page.data.t('about.OSK')}
  </p>
  <p>
    {$page.data.t('about.import_data')}
  </p>
  <p>
    {$page.data.t('about.video_upload')}
  </p>
  <p>
    {$page.data.t('about.export_data')}
  </p>

  <h4
    class="text-2xl leading-8 font-bold text-gray-900 tracking-tight
      sm:text-3xl sm:leading-9 mb-2 mt-3">
    {$page.data.t('about.dev_roadmap')}
  </h4>
  <p>
    {$page.data.t('about.import_export')}
  </p>
  <p>{$page.data.t('about.geo_tagging')}</p>
  <p>{$page.data.t('about.flashcard_view')}</p>
  <p>{$page.data.t('about.peer_review')}</p>
  <p>{$page.data.t('about.suggestions_from_users')}</p>
  <p>{$page.data.t('about.push_notifications')}</p>
  <p>{$page.data.t('about.contributor_awards')}</p>

  <hr style="margin: 40px 0;" />

  <img
    class="mb-4"
    alt="man in front of alphabet and storyboard drawing"
    sizes="auto"
    src="https://lh3.googleusercontent.com/ENct1iLDI3jupgP-g4wK968Y1vMuqwNcYNg1XAwnIwnhsEms_7gyBM3I_a55x8ai61GBk8eY8Cg8QW3Kkw_w=w900"
    srcset="https://lh3.googleusercontent.com/ENct1iLDI3jupgP-g4wK968Y1vMuqwNcYNg1XAwnIwnhsEms_7gyBM3I_a55x8ai61GBk8eY8Cg8QW3Kkw_w=w300
      300w,
      https://lh3.googleusercontent.com/ENct1iLDI3jupgP-g4wK968Y1vMuqwNcYNg1XAwnIwnhsEms_7gyBM3I_a55x8ai61GBk8eY8Cg8QW3Kkw_w=w600
      600w,
      https://lh3.googleusercontent.com/ENct1iLDI3jupgP-g4wK968Y1vMuqwNcYNg1XAwnIwnhsEms_7gyBM3I_a55x8ai61GBk8eY8Cg8QW3Kkw_w=w1200
      1200w" />

  <h3
    class="mb-3 text-2xl leading-8 font-bold text-gray-900 tracking-tight
      sm:text-3xl sm:leading-9">
    {$page.data.t('about.why_document')}
  </h3>
  <p class="mb-3">
    {$page.data.t('about.language_is_history')}
  </p>
  <p class="mb-3">
    {$page.data.t('about.important_to_document')}
  </p>

  <img
    class="mb-4"
    alt="Recording language data"
    sizes="auto"
    src="https://lh3.googleusercontent.com/5vsJJzuYggQZaS50JUs2wuwZMUSM0BaPJHMOJfc83Yy8hvMJrvB3YVRfb9eJTBGqrPbhVEW6pzoAp39S2-pC=w900"
    srcset="https://lh3.googleusercontent.com/5vsJJzuYggQZaS50JUs2wuwZMUSM0BaPJHMOJfc83Yy8hvMJrvB3YVRfb9eJTBGqrPbhVEW6pzoAp39S2-pC=w300
      300w,
      https://lh3.googleusercontent.com/5vsJJzuYggQZaS50JUs2wuwZMUSM0BaPJHMOJfc83Yy8hvMJrvB3YVRfb9eJTBGqrPbhVEW6pzoAp39S2-pC=w600
      600w,
      https://lh3.googleusercontent.com/5vsJJzuYggQZaS50JUs2wuwZMUSM0BaPJHMOJfc83Yy8hvMJrvB3YVRfb9eJTBGqrPbhVEW6pzoAp39S2-pC=w1200
      1200w" />

  <h3
    class="mb-3 text-2xl leading-8 font-bold text-gray-900 tracking-tight
      sm:text-3xl sm:leading-9">
    {$page.data.t('about.what_is_LT')}
  </h3>
  <p class="mb-3">
    {$page.data.t('about.leading_research')}
  </p>
  <p class="mb-3">
    {$page.data.t('about.two_decades_experience')}
  </p>

  <img
    class="mt-3 mb-4"
    alt="Recording plant words"
    sizes="auto"
    src="https://lh3.googleusercontent.com/BeaR13dGwglkfGBEJsJ6qytJLHygBpxapv3MRdGRpkvEnYs1nGZ6mJBfdR_FsovtOJvkELc1XgWozG-OlPUD=w900"
    srcset="https://lh3.googleusercontent.com/BeaR13dGwglkfGBEJsJ6qytJLHygBpxapv3MRdGRpkvEnYs1nGZ6mJBfdR_FsovtOJvkELc1XgWozG-OlPUD=w300
      300w,
      https://lh3.googleusercontent.com/BeaR13dGwglkfGBEJsJ6qytJLHygBpxapv3MRdGRpkvEnYs1nGZ6mJBfdR_FsovtOJvkELc1XgWozG-OlPUD=w600
      600w,
      https://lh3.googleusercontent.com/BeaR13dGwglkfGBEJsJ6qytJLHygBpxapv3MRdGRpkvEnYs1nGZ6mJBfdR_FsovtOJvkELc1XgWozG-OlPUD=w1200
      1200w" />

  <h3
    class="mb-3 text-2xl leading-8 font-bold text-gray-900 tracking-tight
      sm:text-3xl sm:leading-9">
    {$page.data.t('about.translators')}
  </h3>
  <ul class="mb-3">
    <li>
      <b>{$page.data.t('gl.as')}</b>: Palash Nath, Luke Horo, Kapil Medhi, Dr. Seuji
      Sharma, Dr. Gitanjali Bezbaruah, Biren Baruah, Khagendra Nath Medhi, Pranab Sharma, Dhanmani
      Baishya, Chan Mohammad Ali, Rahul Choudhary
    </li>
    <li>
      <b>{$page.data.t('gl.bn')}</b>: Sumedha Sengupta, Prof. Arun Ghosh
    </li>
    <li>
      <b>{$page.data.t('gl.fr')}</b>: Anna Luisa Daigneault
    </li>
    <li>
      <b>{$page.data.t('gl.he')}</b>: Dana Melaver, Daniel Bögre Udell
    </li>
    <li>
      <b>{$page.data.t('gl.sw')}</b>: Michael Karani
    </li>
    <li>
      <b>{$page.data.t('gl.hi')}</b>: Ashwini Parmar, Luke Horo, Bikram Jora, Prof. K.V.
      Subbarao
    </li>
    <li>
      <b>{$page.data.t('gl.or')}</b>: Anup Kumar Kujur, Panchanan Mohanty
    </li>
    <li>
      <b>{$page.data.t('gl.pt')}</b>: Crisofia Langa da Camara
    </li>
    <li>
      <b>{$page.data.t('gl.ru')}</b>: Denis Tokmashev
    </li>
    <li>
      <b>{$page.data.t('gl.sn')}</b>: Reggemore Marongedze
    </li>
    <li>
      <b>{$page.data.t('gl.es')}</b>: Anna Luisa Daigneault, Amanda Chao Benbassat,
      Mónica Bonilla Parra
    </li>
    <li>
      <b>{$page.data.t('gl.ms')}</b>: Nur Hidayah Binte Sunaryo
    </li>
    <li><b>{$page.data.t('gl.zu')}</b>: Mthulisi Ncube</li>
    <li>
      <b>{$page.data.t('gl.it')}</b>: Iara Mantenuto
    </li>
    <li><b>{$page.data.t('gl.cmn')}</b>: Peng Dong, Joy Wu</li>
    <li><b>{$page.data.t('gl.tzm')}</b>: Radia Sami</li>
    <li><b>{$page.data.t('gl.vi')}</b>: Huy Phan</li>
    <li><b>{$page.data.t('gl.id')}</b>: Yustinus Ghanggo Ate</li>
  </ul>

  <h3
    class="mb-3 text-2xl leading-8 font-bold text-gray-900 tracking-tight
      sm:text-3xl sm:leading-9">
    {$page.data.t('about.interns')} (Living Tongues Institute)
  </h3>
  <p class="mb-3">
    Ashlie Devenney, Thorin Engeseth, Ariel Rabkin-Meyer, Ella Hannon, Cassie Gritton, Peyton A.
    Nesler, Emilie Erbland, Kyra O’Connell, Louis Fillman, Liam Marshall-Butler, Shuangqi (Joy) Wu,
    Catherine Huang, Molly Cutler, Luke Strom, Sydney Louchard, Alexis O'Connor, Cassidy Parong,
    Chloe Bourdon, Sichen (Larry) Lyu, Tali Tukachinsky, Valeria Macias, Evelyn Ho, Barbara Lourenco
    Oliveira Moreira, Adviye Pelin Teberoğlu, Sophie Shields, Anthony James Brandy, Rammi Quah,
    Alexandra Winslade, Gabriela Collaço Horton, Vikram Nagapudi, Sasha Viola Fennimore, Polly
    Vishner, Loren Schneider, Kiasah Izzati, Manuel Aguilera, Maksymilian Rębisz, Rachel Mattie,
    Aarushi Asthana, Akano Johnson, Selena Syrett.
  </p>

  <h3
    class="mb-3 text-2xl leading-8 font-bold text-gray-900 tracking-tight
      sm:text-3xl sm:leading-9">
    {$page.data.t('about.help_us_launch_more')}
  </h3>
  <p class="mb-3">
    {$page.data.t('about.with_your_help')}
  </p>
  <Button
    form="filled"
    class="w-full my-3"
    target="_blank"
    href="https://www.flipcause.com/secure/cause_pdetails/NTQ3NDQ"
    rel="noopener">
    {$page.data.t('header.donate')}
  </Button>
</div>

<Footer />

<SeoMetaTags
  title={$page.data.t('about.about_LD')}
  description="Living Dictionaries are mobile-friendly web tools that support endangered, under-represented and diasporic languages. Led by community activists around the globe, Living Dictionaries are collaborative multimedia projects that help languages survive for generations to come."
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Tongues Institute for Endangered Languages, Gregory D. S. Anderson" />

<!-- Used to have TOU link here -->
<style>
  img {
    max-width: 100%;
  }
</style>
