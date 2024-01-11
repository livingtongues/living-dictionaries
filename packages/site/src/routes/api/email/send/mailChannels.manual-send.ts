// import { readFileSync } from 'fs'
// import type { MailChannelsSendBody } from './mail-channels.interface'
// import { sendEmail } from './mailChannels'
// import recipients from '../html/2023-year-end-recipients'

// const from = {
//   email: 'no-reply@livingdictionaries.app',
//   name: 'Living Tongues Institute for Endangered Languages',
// };

// const DKIM_PRIVATE_KEY = 'ADD HERE'

// vi.mock('$env/static/private', () => {
//   return {
//     MAILCHANNELS_WORKER_KEY: 'ADD HERE',
//   }
// })

// describe(sendEmail, () => {
//   test('sends emails one at a time', async () => {
//     const html = readFileSync('./packages/site/src/routes/api/email/html/2023-year-end.html', 'utf-8')

//     for (const recipient of recipients) {
//       const mailChannelsSendBody: MailChannelsSendBody = {
//         personalizations: [{
//           to: [{email: recipient}],
//           dkim_domain: 'livingdictionaries.app',
//           dkim_selector: 'notification',
//           dkim_private_key: DKIM_PRIVATE_KEY,
//         }],
//         from,
//         reply_to: { email: 'annaluisa@livingtongues.org' },
//         subject: 'Living Dictionaries - News and Numbers from 2023',
//         content: [{
//           type: 'text/html',
//           value: html,
//         }],
//       };

//       const response = await sendEmail(mailChannelsSendBody, fetch)
//       expect(response.status).toBe(202)
//       console.info(`Sent email to ${recipient}`)
//       await new Promise(resolve => setTimeout(resolve, 1000))
//     }
//   }, {timeout: 10000000})
// })
