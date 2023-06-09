# Easy Email Sending

Using MailChannels and a Cloudflare Worker as described in
https://mailchannels.zendesk.com/hc/en-us/articles/4565898358413-Sending-Email-from-Cloudflare-Workers-using-MailChannels-Send-API

Then added DKIM with help from  https://support.mailchannels.com/hc/en-us/articles/7122849237389-Adding-a-DKIM-Signature

The following is placed into a Cloudflare Worker after adding in the API_KEY:
```js
// status codes: https://restfulapi.net/http-status-codes/#4xx

const AUTH_HEADER_KEY = 'x-api-key';
const AUTH_HEADER_VALUE = 'CHANGE_TO_API_KEY';

async function handleRequest(request) {
  if (request.method.toUpperCase() !== 'POST') return new Response('Error: Must be a POST request', { status: 405 });

  const apiKey = request.headers.get(AUTH_HEADER_KEY);
  if (apiKey !== AUTH_HEADER_VALUE) return new Response('Invalid API key', { status: 403 });

  if (request.headers.get('Content-Type') !== 'application/json') return new Response("'Content-Type' must be 'application/json'", { status: 406 });

  const requestBody = await request.json();
  const send_request = new Request('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const response = await fetch(send_request);

  // const responseText = await response.clone().text();
  // console.log({ responseText, response: JSON.stringify(response) })

  return response
}

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});
```