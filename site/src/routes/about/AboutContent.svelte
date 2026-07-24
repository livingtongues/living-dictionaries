<script lang="ts">
  import { page } from '$app/state'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import IconMdiPencilOutline from '~icons/mdi/pencil-outline'
  import IconMdiAccountGroupOutline from '~icons/mdi/account-group-outline'
  import IconMdiWaveform from '~icons/mdi/waveform'
  import IconMdiImageOutline from '~icons/mdi/image-outline'
  import IconMdiVideoOutline from '~icons/mdi/video-outline'
  import IconMdiVectorLink from '~icons/mdi/vector-link'
  import IconMdiFormatQuoteClose from '~icons/mdi/format-quote-close'
  import IconMdiFileTreeOutline from '~icons/mdi/file-tree-outline'
  import IconMdiMagnify from '~icons/mdi/magnify'
  import IconMdiKeyboardOutline from '~icons/mdi/keyboard-outline'
  import IconMdiTranslate from '~icons/mdi/translate'
  import IconMdiCloudOffOutline from '~icons/mdi/cloud-off-outline'
  import IconMdiMapMarkerOutline from '~icons/mdi/map-marker-outline'
  import IconMdiLockOutline from '~icons/mdi/lock-outline'
  import IconMdiDatabaseImportOutline from '~icons/mdi/database-import-outline'
  import IconMdiDatabaseExportOutline from '~icons/mdi/database-export-outline'
  import IconMdiCounter from '~icons/mdi/counter'
  import IconMdiRobotOutline from '~icons/mdi/robot-outline'

  const t = $derived(page.data.t)

  const features: { key: string, icon: typeof IconMdiWaveform, accent: string }[] = [
    { key: 'manage_entries', icon: IconMdiPencilOutline, accent: '#3b82f6' },
    { key: 'real_time_collab', icon: IconMdiAccountGroupOutline, accent: '#10b981' },
    { key: 'record_playback_audio', icon: IconMdiWaveform, accent: '#8b5cf6' },
    { key: 'photo_upload', icon: IconMdiImageOutline, accent: '#ec4899' },
    { key: 'video_upload', icon: IconMdiVideoOutline, accent: '#f43f5e' },
    { key: 'related_entries', icon: IconMdiVectorLink, accent: '#06b6d4' },
    { key: 'example_sentences', icon: IconMdiFormatQuoteClose, accent: '#14b8a6' },
    { key: 'SD', icon: IconMdiFileTreeOutline, accent: '#f59e0b' },
    { key: 'search', icon: IconMdiMagnify, accent: '#0ea5e9' },
    { key: 'OSK', icon: IconMdiKeyboardOutline, accent: '#8b5cf6' },
    { key: 'community_translated', icon: IconMdiTranslate, accent: '#a855f7' },
    { key: 'offline_data', icon: IconMdiCloudOffOutline, accent: '#64748b' },
    { key: 'geo_tagging', icon: IconMdiMapMarkerOutline, accent: '#ef4444' },
    { key: 'private_public', icon: IconMdiLockOutline, accent: '#0d9488' },
    { key: 'import_data', icon: IconMdiDatabaseImportOutline, accent: '#f59e0b' },
    { key: 'export_data', icon: IconMdiDatabaseExportOutline, accent: '#22c55e' },
    { key: 'entry_count', icon: IconMdiCounter, accent: '#6366f1' },
  ]

  const roadmap = [
    'flashcard_view',
    'peer_review',
    'suggestions_from_users',
    'push_notifications',
    'contributor_awards',
  ]
</script>

<div class="page-column">
  <h1 class="page-title">{t('about.about_LD')}</h1>

  <p class="lead">{t('about.online_tool')}</p>
  <p class="spaced">{t('about.promote_connectivity')}</p>
  <p class="spaced">{t('about.td_beginnings')}</p>

  <h2 class="section-title">{t('about.current_features')}</h2>
  <div class="feature-grid">
    {#each features as feature (feature.key)}
      <div class="feature">
        <div class="icon-chip" style:--accent={feature.accent}>
          <feature.icon style="font-size: 1.25rem" />
        </div>
        <span class="feature-label">{t({ dynamicKey: `about.${feature.key}` })}</span>
      </div>
    {/each}
  </div>

  <div class="api-band">
    <div class="api-head">
      <div class="api-chip"><IconMdiRobotOutline style="font-size: 1.5rem" /></div>
      <h2>{t('about.api_heading')}</h2>
    </div>
    <p>{t('about.api_body_1')}</p>
    <p>{t('about.api_body_2')}</p>
  </div>

  <h2 class="section-title">{t('about.dev_roadmap')}</h2>
  <div class="roadmap">
    {#each roadmap as item (item)}
      <span class="pill">{t({ dynamicKey: `about.${item}` })}</span>
    {/each}
  </div>

  <figure class="figure">
    <img
      alt="man in front of alphabet and storyboard drawing"
      loading="lazy"
      src="https://lh3.googleusercontent.com/ENct1iLDI3jupgP-g4wK968Y1vMuqwNcYNg1XAwnIwnhsEms_7gyBM3I_a55x8ai61GBk8eY8Cg8QW3Kkw_w=w900"
      srcset="https://lh3.googleusercontent.com/ENct1iLDI3jupgP-g4wK968Y1vMuqwNcYNg1XAwnIwnhsEms_7gyBM3I_a55x8ai61GBk8eY8Cg8QW3Kkw_w=w300 300w, https://lh3.googleusercontent.com/ENct1iLDI3jupgP-g4wK968Y1vMuqwNcYNg1XAwnIwnhsEms_7gyBM3I_a55x8ai61GBk8eY8Cg8QW3Kkw_w=w600 600w, https://lh3.googleusercontent.com/ENct1iLDI3jupgP-g4wK968Y1vMuqwNcYNg1XAwnIwnhsEms_7gyBM3I_a55x8ai61GBk8eY8Cg8QW3Kkw_w=w1200 1200w" />
  </figure>

  <h2 class="section-title">{t('about.why_document')}</h2>
  <p class="spaced">{t('about.language_is_history')}</p>
  <p class="spaced">{t('about.important_to_document')}</p>

  <figure class="figure">
    <img
      alt="Recording language data"
      loading="lazy"
      src="https://lh3.googleusercontent.com/5vsJJzuYggQZaS50JUs2wuwZMUSM0BaPJHMOJfc83Yy8hvMJrvB3YVRfb9eJTBGqrPbhVEW6pzoAp39S2-pC=w900"
      srcset="https://lh3.googleusercontent.com/5vsJJzuYggQZaS50JUs2wuwZMUSM0BaPJHMOJfc83Yy8hvMJrvB3YVRfb9eJTBGqrPbhVEW6pzoAp39S2-pC=w300 300w, https://lh3.googleusercontent.com/5vsJJzuYggQZaS50JUs2wuwZMUSM0BaPJHMOJfc83Yy8hvMJrvB3YVRfb9eJTBGqrPbhVEW6pzoAp39S2-pC=w600 600w, https://lh3.googleusercontent.com/5vsJJzuYggQZaS50JUs2wuwZMUSM0BaPJHMOJfc83Yy8hvMJrvB3YVRfb9eJTBGqrPbhVEW6pzoAp39S2-pC=w1200 1200w" />
  </figure>

  <h2 class="section-title">{t('about.what_is_LT')}</h2>
  <p class="spaced">{t('about.leading_research')}</p>
  <p class="spaced">{t('about.two_decades_experience')}</p>

  <figure class="figure">
    <img
      alt="Recording plant words"
      loading="lazy"
      src="https://lh3.googleusercontent.com/BeaR13dGwglkfGBEJsJ6qytJLHygBpxapv3MRdGRpkvEnYs1nGZ6mJBfdR_FsovtOJvkELc1XgWozG-OlPUD=w900"
      srcset="https://lh3.googleusercontent.com/BeaR13dGwglkfGBEJsJ6qytJLHygBpxapv3MRdGRpkvEnYs1nGZ6mJBfdR_FsovtOJvkELc1XgWozG-OlPUD=w300 300w, https://lh3.googleusercontent.com/BeaR13dGwglkfGBEJsJ6qytJLHygBpxapv3MRdGRpkvEnYs1nGZ6mJBfdR_FsovtOJvkELc1XgWozG-OlPUD=w600 600w, https://lh3.googleusercontent.com/BeaR13dGwglkfGBEJsJ6qytJLHygBpxapv3MRdGRpkvEnYs1nGZ6mJBfdR_FsovtOJvkELc1XgWozG-OlPUD=w1200 1200w" />
  </figure>

  <h2 class="section-title">{t('about.translators')}</h2>
  <ul class="credits">
    <li><b>{t('gl.as')}</b>: Palash Nath, Luke Horo, Kapil Medhi, Dr. Seuji Sharma, Dr. Gitanjali Bezbaruah, Biren Baruah, Khagendra Nath Medhi, Pranab Sharma, Dhanmani Baishya, Chan Mohammad Ali, Rahul Choudhary</li>
    <li><b>{t('gl.bn')}</b>: Sumedha Sengupta, Prof. Arun Ghosh</li>
    <li><b>{t('gl.fr')}</b>: Anna Luisa Daigneault</li>
    <li><b>{t('gl.he')}</b>: Dana Melaver, Daniel Bögre Udell</li>
    <li><b>{t('gl.sw')}</b>: Michael Karani</li>
    <li><b>{t('gl.hi')}</b>: Ashwini Parmar, Luke Horo, Bikram Jora, Prof. K.V. Subbarao</li>
    <li><b>{t('gl.or')}</b>: Anup Kumar Kujur, Panchanan Mohanty</li>
    <li><b>{t('gl.pt')}</b>: Crisofia Langa da Camara</li>
    <li><b>{t('gl.ru')}</b>: Denis Tokmashev</li>
    <li><b>{t('gl.sn')}</b>: Reggemore Marongedze</li>
    <li><b>{t('gl.es')}</b>: Anna Luisa Daigneault, Amanda Chao Benbassat, Mónica Bonilla Parra</li>
    <li><b>{t('gl.ms')}</b>: Nur Hidayah Binte Sunaryo</li>
    <li><b>{t('gl.zu')}</b>: Mthulisi Ncube</li>
    <li><b>{t('gl.it')}</b>: Iara Mantenuto</li>
    <li><b>{t('gl.cmn')}</b>: Peng Dong, Joy Wu</li>
    <li><b>{t('gl.tzm')}</b>: Radia Sami</li>
    <li><b>{t('gl.vi')}</b>: Huy Phan</li>
    <li><b>{t('gl.id')}</b>: Yustinus Ghanggo Ate</li>
  </ul>

  <h2 class="section-title">{t('about.interns')} (Living Tongues Institute)</h2>
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

  <div class="donate-card">
    <h2 class="section-title" style="margin: 0">{t('about.help_us_launch_more')}</h2>
    <p class="spaced">{t('about.with_your_help')}</p>
    <HeadlessButton

      class="btn-primary btn-default donate-button"
      target="_blank"
      href="https://www.paypal.com/donate?hosted_button_id=QCELFXU8ZGTVC"
      rel="noopener">
      {t('header.donate')}
    </HeadlessButton>
  </div>
</div>

<style>
  .page-column {
    max-width: 768px;
    margin-left: auto;
    margin-right: auto;
    padding: 1rem 0.75rem 2rem;
  }

  .page-title {
    margin-bottom: 1.25rem;
    font-size: 1.875rem;
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--color);
  }

  @media (min-width: 640px) {
    .page-title {
      font-size: 2.5rem;
    }
  }

  .lead {
    font-size: 1.125rem;
    line-height: 1.6;
    color: var(--color);
    margin-bottom: 0.75rem;
  }

  .section-title {
    font-size: 1.375rem;
    line-height: 1.2;
    font-weight: 700;
    color: var(--color);
    letter-spacing: -0.02em;
    margin: 2.5rem 0 1rem;
  }

  @media (min-width: 640px) {
    .section-title {
      font-size: 1.625rem;
    }
  }

  .spaced {
    margin-bottom: 0.75rem;
    line-height: 1.6;
  }

  /* Feature grid */
  .feature-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  @media (min-width: 480px) {
    .feature-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .feature {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: var(--surface);
    border-radius: 0.625rem;
    padding: 0.625rem 0.875rem;
  }

  .icon-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.5rem;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .feature-label {
    font-size: 0.9375rem;
    font-weight: 500;
    line-height: 1.3;
  }

  /* API band */
  .api-band {
    margin-top: 2.5rem;
    background: color-mix(in srgb, var(--primary) 6%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--primary) 25%, transparent);
    border-radius: 0.875rem;
    padding: 1.5rem;
  }

  .api-head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.875rem;
  }

  .api-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 0.625rem;
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 14%, transparent);
  }

  .api-head h2 {
    margin: 0;
    font-size: 1.375rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .api-band p {
    margin: 0 0 0.75rem;
    line-height: 1.6;
    color: var(--color);
  }

  .api-band p:last-child {
    margin-bottom: 0;
  }

  /* Roadmap pills */
  .roadmap {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    padding: 0.4rem 0.875rem;
    border-radius: 9999px;
    background: var(--surface);
    border: 1px dashed color-mix(in srgb, var(--color) 25%, transparent);
    font-size: 0.875rem;
    color: var(--color-secondary);
  }

  /* Figures */
  .figure {
    margin: 1.5rem 0 0;
  }

  .figure img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 0.875rem;
  }

  /* Credits */
  .credits {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }

  .credits li {
    line-height: 1.5;
  }

  .credits b {
    color: var(--color);
  }

  /* Donate */
  .donate-card {
    margin-top: 2.5rem;
    background: var(--surface);
    border-radius: 0.875rem;
    padding: 1.5rem;
    text-align: center;
  }

  .donate-card :global(.donate-button) {
    width: 100%;
    max-width: 20rem;
    margin: 0.5rem auto 0;
  }
</style>
