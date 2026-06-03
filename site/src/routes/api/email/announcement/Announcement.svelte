<script lang="ts">
  import Header from '../components/Header.svelte'
  import Title from '../components/Title.svelte'
  import Shell from '../components/Shell.svelte'
  import Paragraph from '../components/Paragraph.svelte'
  import Footer from '../components/Footer.svelte'

  export let preview = 'Recent entry loading issues have been resolved'

  const title = 'Improved Entry Loading'
  const theme_color = '#546e7a'
  const brand = 'Living Dictionaries'

  const campaign_suffix = '?utm_source=functions&utm_medium=email&utm_campaign=announcement'
  const home_url = `https://livingdictionaries.app${campaign_suffix}`
</script>

<Shell dark={false} {preview} {title}>
  <Header {brand} href={home_url} row={{ backgroundColor: theme_color }} />
  <Title text={title} row={{ top: 35 }} />
  <Paragraph row={{ top: 20 }}>
    Dear Living Dictionaries community,
  </Paragraph>
  <Paragraph row={{ top: 20 }}>
    Good news: we recently resolved some bugs on our platform! Over the past 6 weeks, there were entry loading issues, especially for the large Living Dictionaries. Some of you may have seen a "timeout" error message occur on your dictionary homepage. All loading problems have now been resolved.
  </Paragraph>
  <Paragraph row={{ top: 20 }}>
    If you haven't been on the platform in the last week and notice that loading problems persist for you when you visit next time, please refresh the page once after letting everything load.
  </Paragraph>
  <Paragraph row={{ top: 20 }}>
    If you still have trouble accessing your dictionary or experience loading issues, please use the "Contact Us" form to send us a descriptive message of your issue and we will take a look. Keep in mind that our platform is run by a small, dedicated team here at Living Tongues Institute.
  </Paragraph>
  <Paragraph row={{ top: 20 }}>
    Thank you all for continuing to build your Living Dictionaries. The progress being made is remarkable.
  </Paragraph>
  <Paragraph row={{ top: 20 }}>
    warm wishes,
  </Paragraph>
  <Paragraph row={{ bottom: 40 }}>
    The Living Dictionaries team (Anna, Diego, Greg and Jacob)
  </Paragraph>

  <Footer {brand} href={home_url} address="4676 Commercial St SE, # 454 | Salem, Oregon, OR 97302 | USA" reason_for_email="You're receiving this email because you have a Living Dictionaries account." show_unsubscribe={false} row={{ backgroundColor: '#dddddd', space: 20 }} />
</Shell>
