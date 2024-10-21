<script lang="ts">
  import Header from '../components/Header.svelte'
  import Title from '../components/Title.svelte'
  import Shell from '../components/Shell.svelte'
  import Paragraph from '../components/Paragraph.svelte'
  import Footer from '../components/Footer.svelte'
  import DashedLine from '../components/DashedLine.svelte'

  export let preview = 'You will not be able to edit your dictionary for about 24 hours on October 22-23.'

  const title = 'Database Maintenance Notice'
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
    We are making some important improvements to our database that require us to turn off editing ability for approximately 24 hours next week. Starting at <strong>7PM Eastern Time (New York) on Tuesday, October 22nd</strong>, please do not edit or add entries to your dictionary for 24 hours. No changes you make to your dictionary will be saved in the database. All existing data will remain the same. Please wait until you receive an email from us on October 23rd or October 24th before starting to edit again. Sorry for the inconvenience.
  </Paragraph>
  <Paragraph row={{ top: 20 }}>
    The public can still view and search your dictionaries as normal. They shouldn’t notice any disruption in service, so there’s no need to inform them.
  </Paragraph>
  <Paragraph row={{ top: 20 }}>
    Thank you for your continuing support of our platform. We are excited for the future improvements these changes prepare the platform for! New features are coming.
  </Paragraph>
  <Paragraph row={{ top: 20 }}>
    ~ The Living Tongues team
  </Paragraph>
  <DashedLine row={{ top: 20 }} />

  <Paragraph row={{ top: 20 }}>
    Querida comunidad de diccionarios vivos.
  </Paragraph>
  <Paragraph row={{ top: 20 }}>
    La semana que viene realizaremos algunas mejoras importantes en nuestra base de datos. Esto nos obligará a desactivar la función de edición durante un breve periodo de tiempo (aproximadamente 24 horas). Rogamos disculpen las molestias que esto les pueda ocasionar.
  </Paragraph>
  <Paragraph row={{ top: 20 }}>
    A partir de las 19.00 horas tiempo del Este (Nueva York) del martes 22 de octubre, les pedimos de favor que no editen ni añadan entradas a sus diccionarios vivos. Los cambios realizados en el diccionario no se registrarán en la base de datos. Los datos existentes no se modificarán. Recibirán un correo electrónico nuestro el 23 (o 24) de octubre; esperen a recibir este correo antes de volver a editar su diccionario.
  </Paragraph>
  <Paragraph row={{ top: 20 }}>
    El público podrá seguir consultando sus diccionarios vivos como de costumbre. El público no notará ninguna interrupción en el servicio. Gracias por su continuo apoyo a nuestra plataforma. Pronto tendremos nuevas funcionalidades.
  </Paragraph>
  <Paragraph row={{ top: 20 }}>
    ~ El equipo del Instituto de Living Tongues
  </Paragraph>
  <DashedLine row={{ top: 20 }} />

  <Paragraph row={{ top: 20 }}>
    Chers rédacteurs des dictionnaires vivants,
  </Paragraph>
  <Paragraph row={{ top: 20 }}>
    La semaine prochaine, nous apporterons d’importantes améliorations à notre base de données. Ceci nous oblige de désactiver la fonction d’édition pendant une courte période de temps (environ 24 heures). Nous vous prions de nous excuser pour les problèmes que cela pourrait vous causer.
  </Paragraph>
  <Paragraph row={{ top: 20 }}>
    À partir de 19 heures, heure de l’Est (New York), le mardi 22 octobre, nous vous prions de ne pas modifier ou ajouter d’entrées à votre dictionnaire vivant. Aucune modification apportée à votre dictionnaire ne sera enregistrée dans la base de données. Toutes les données existantes ne seront pas changées. Vous recevrez un courriel de notre part le 23 (ou le 24) octobre; SVP attendez ce courriel avant de recommencer à modifier votre dictionnaire.
  </Paragraph>
  <Paragraph row={{ top: 20 }}>
    Le public peut toujours consulter vos dictionnaires vivants comme d’habitude. Le public ne remarquera aucune interruption de service. Nous vous remercions de votre soutien continu à notre plateforme. De nouvelles fonctionnalités sont à venir.
  </Paragraph>
  <Paragraph row={{ top: 20, bottom: 20 }}>
    ~ L’équipe de l’institut Living Tongues
  </Paragraph>
  <Footer {brand} href={home_url} address="4676 Commercial St SE, # 454 | Salem, Oregon, OR 97302 | USA" reason_for_email="You're receiving this email because you have a Living Dictionaries account." show_unsubscribe={false} row={{ backgroundColor: '#dddddd', space: 20 }} />
</Shell>
