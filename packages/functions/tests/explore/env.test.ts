import { testFun } from '../test-config';
testFun.cleanup;
// import * as admin from 'firebase-admin';

import { supportEmail } from '../../src/index';

const envConfig = {
  // sendgrid: { key: env.sendgrid }
};

test.skip('supportEmail sends email (check email inbox)', () => {
  testFun.mockConfig(envConfig);

  const wrapped = testFun.wrap(supportEmail);
  const data = {
    message: 'Hello',
    email: 'CHANGE',
    name: 'Test Function',
    url: 'https://td-dev-svelte.web.app/achi-1579819002171/entries/list',
  };
  wrapped(data).then(() => {
    // should spy on email sending function to make sure it was called
    console.log('nothing to assert here, check email to find result of test');
    expect(true).toBe(true);
  });
});
// test('success', () => {
//     const req = { body: { card: '4242424242424242' } };

//     const res = {
//         send: (response: any) => {
//             //Run the test in response callback of the HTTPS function
//             expect(response).toBe('Hello, World!');
//             //done() is to be triggered to finish the function
//             // done();
//         }
//     };

//     helloWorld(req as any, res as any);
// });

// describe('makePayment', () => {

//   test('it returns a successful response with a valid card', () => {
//     const req = { body: { card: '4242424242424242' } };
//     const res = {
//       send: (payload) => {
//         expect(payload).toBe('Payment processed!')
//       },
//     };

//     env(req as any, res as any);
//   });

//   test('it returns an error with an invalid card', () => {
//     const req = { body: { card: null } };
//     const res = {
//       send: (payload) => {
//         expect(payload).toBe('Missing card!')
//       },
//     };

//     makePayment(req as any, res as any);
//   });
// });
