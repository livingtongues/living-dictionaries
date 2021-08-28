<script lang="ts">
  import { _ } from 'svelte-i18n';
  import View from '$lib/components/ui/View.svelte';
  import Header from '$lib/components/shell/Header.svelte';
  import Button from '$svelteui/ui/Button.svelte';
</script>

<svelte:head>
  <title>
    {$_('about.about_LD', { default: 'About Living Dictionaries' })}
  </title>
</svelte:head>

<Header>
  {$_('about.about_LD', { default: 'About Living Dictionaries' })}
</Header>

<View maxWidth={true} padding={true}>
  <h3
    class="mb-6 text-3xl leading-8 font-bold tracking-tight text-gray-900
    sm:text-4xl sm:leading-10">
    {$_('about.about_LD', { default: 'About Living Dictionaries' })}
  </h3>

  <p class="mb-3">
    {$_('about.online_tool', {
      default:
        'Living Dictionaries is an online tool built with the latest web technologies in an effort to speed the availability of language resources for every endangered language in the world. Tools such as this have the power to shift how we think about endangered languages. Rather than perceiving these tongues as being antiquated, difficult to learn and on the brink of vanishing, we can see them as modern, accessible for learning, and easily visible and audible online.',
    })}
  </p>
  <p class="mb-3">
    {$_('about.promote_connectivity', {
      default:
        'Living Dictionaries promote connectivity over vast distances, and support an online community of language learners who wish to hear and learn a language without close proximity to fluent speakers. They allow thousands of recorded entries to be available at one’s fingertips. High-quality audio recordings accompany the dictionary entries so that community members, new speakers and research scholars can listen to the correct pronunciation by a fluent speaker. Engaging images also provide a wider sense of the cultural context for the language.',
    })}
  </p>
  <p class="mb-3">
    {$_('about.td_beginnings', {
      default:
        'Linguists at Living Tongues Institute for Endangered Languages, Dr. Gregory D. S. Anderson and Dr. K. David Harrison, first spearheaded the Living Dictionaries in 2006 as exceptional digital tools to help preserve and learn words and phrases in endangered languages. Now in a mobile-friendly format, with an offline mode available for working in areas with little to no internet, the Living Dictionaries will reach new audiences and serve more speech communities.',
    })}
  </p>

  <hr style="margin: 40px 0;" />

  <h4
    class="text-2xl leading-8 font-bold text-gray-900 tracking-tight
    sm:text-3xl sm:leading-9 mb-2">
    {$_('about.current_features', { default: 'Current Dictionary Features' })}
  </h4>
  <p>
    {$_('about.manage_entries', {
      default: 'Manage Dictionary: View & Edit Entries in Real-Time',
    })}
  </p>
  <p>
    {$_('about.record_playback_audio', { default: 'Record & Playback Audio' })}
  </p>
  <p>{$_('about.photo_upload', { default: 'Photo Upload' })}</p>
  <p>{$_('about.offline_data', { default: 'Offline Data Access' })}</p>
  <p>{$_('about.search', { default: 'Search' })}</p>
  <p>{$_('about.entry_count', { default: 'Entry Count' })}</p>
  <p>{$_('about.SD', { default: 'Semantic Domains' })}</p>
  <p>
    {$_('about.private_public', {
      default: 'Set Dictionaries as Private or Public',
    })}
  </p>
  <p>
    {$_('about.OSK', { default: 'On-Screen Keyboards for Glossing Languages' })}
  </p>
  <p>
    {$_('about.import_data', { default: 'Import Data (CSV, JSON formats)' })}
  </p>

  <h4
    class="text-2xl leading-8 font-bold text-gray-900 tracking-tight
    sm:text-3xl sm:leading-9 mb-2 mt-3">
    {$_('about.dev_roadmap', { default: 'Development Roadmap' })}
  </h4>
  <p>
    Import/Export
    <br />
    <i>(FLEx, Standard Format)</i>
  </p>
  <p>Geo-tagging Entries</p>
  <p>Flashcard View for Language Learners</p>
  <p>Peer Review of Spellings</p>
  <p>Suggestions from Users</p>
  <p>Push Notifications to Contributors</p>
  <p>Contributor Community Awards</p>
  <p>Video Upload</p>

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
    {$_('about.why_document', {
      default: 'Why document endangered languages?',
    })}
  </h3>
  <p class="mb-3">
    {$_('about.language_is_history', {
      default:
        'Languages are humanity’s living history; they encode centuries of ancestral wisdom related to the environment, local culture and much more. Language is the vital, creative lens through which we perceive the world and express ourselves. There are over 3,000 threatened and endangered languages in the world, and it is up to our current generation to address this urgent problem before it’s too late.',
    })}
  </p>
  <p class="mb-3">
    {$_('about.important_to_document', {
      default:
        'Not only is it important to scientifically document and preserve endangered languages, but from an educational standpoint, learning one’s heritage language is a boost for communities who wish to conserve and celebrate their cultural identity, locally as well as internationally. Knowing about one’s linguistic and cultural origins has significant, positive health impacts, and this translates to better well-being of the community in the long-term.',
    })}
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
    {$_('about.what_is_LT', {
      default: 'What is Living Tongues Institute for Endangered Languages?',
    })}
  </h3>
  <p class="mb-3">
    {$_('about.leading_research', {
      default:
        'Living Tongues Institute for Endangered Languages is a leading research organization dedicated to documenting endangered languages. Founded by linguist Dr. Gregory D. S. Anderson, Living Tongues Institute is a non-profit research institute based in Salem, Oregon, with remote researchers and collaborators located around the globe.',
    })}
  </p>
  <p class="mb-3">
    {$_('about.two_decades_experience', {
      default:
        'With nearly two decades of fieldwork experience, we have the skills and methods in place to help communities document, protect, and promote their languages. Our teams conduct documentary linguistic fieldwork, publish scientific papers and present at academic conferences. We also run digital training workshops to empower language activists, and collaborate with speakers of endangered languages to teach them how to release their own online Living Dictionaries. Furthermore, we raise awareness about endangered languages and support language revitalization efforts in many of the communities we work in.',
    })}
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
    {$_('about.translators', {
      default: 'Translators',
    })}
  </h3>
  <ul class="mb-3">
    <li>
      {$_('gl.as', { default: 'Assamese' })}: Palash Nath, Luke Horo
    </li>
    <li>{$_('gl.bn', { default: 'Bangla' })}: Sumedha Sengupta</li>
    <li>{$_('gl.fr', { default: 'French' })}: Anna Luisa Daigneault</li>
    <li>
      {$_('gl.he', { default: 'Hebrew' })}: Dana Melaver, Daniel Bögre Udell
    </li>
    <li>{$_('gl.sw', { default: 'KiSwahili' })}: Michael Karani</li>
    <li>{$_('gl.hi', { default: 'Hindi' })}: Luke Horo, Bikram Jora</li>
    <li>{$_('gl.or', { default: 'Oriya' })}: Anup Kumar Kujur</li>
    <li>{$_('gl.pt', { default: 'Portuguese' })}: Crisofia Langa da Camara</li>
    <li>{$_('gl.or', { default: 'Oriya' })}: Anup Kumar Kujur</li>
    <li>{$_('gl.ru', { default: 'Russian' })}: Denis Tokmashev</li>
    <li>{$_('gl.sn', { default: 'Shona' })}: Reggemore Marongedze</li>
    <li>
      {$_('gl.es', { default: 'Spanish' })}: Anna Luisa Daigneault, Amanda Chao Benbassat, Mónica
      Bonilla Parra
    </li>
  </ul>

  <h3
    class="mb-3 text-2xl leading-8 font-bold text-gray-900 tracking-tight
    sm:text-3xl sm:leading-9">
    {$_('about.help_us_launch_more', {
      default: 'Help Us Launch More Living Dictionaries',
    })}
  </h3>
  <p class="mb-3">
    {$_('about.with_your_help', {
      default:
        'With your help, we can continue to improve our software and make it available for anyone or any group who wishes to create their own Living Dictionary for their community’s language. Our goal is to launch 100 new Living Dictionaries every year for the next 30 years (yes, indeed, that’s 3,000 dictionaries!). Our long-term goal is to have a Living Dictionary online for each of the 3,000+ threatened languages in the world by 2050. Donate today and make an impact!',
    })}
  </p>
  <Button
    form="primary"
    class="w-full my-3"
    target="_blank"
    href="https://www.flipcause.com/secure/cause_pdetails/NTQ3NDQ"
    rel="noopener">
    {$_('header.donate', { default: 'Donate' })}
  </Button>
</View>

<!-- Used to have TOU link here -->
<style>
  img {
    max-width: 100%;
  }
</style>
