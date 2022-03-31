/* tslint:disable */
import * as firebase from '@firebase/testing';

/**
 * The emulator will accept any project ID for testing.
 */
const PROJECT_ID = `rules-spec-${Date.now()}`; // 'talking-dictionaries-dev'

/**
 * Creates a new admin FirebaseApp and returns the Firestore instance.
 */
export const getAdminFirestore = () => {
  return firebase.initializeAdminApp({ projectId: PROJECT_ID }).firestore();
};

export const clearFirestore = async () => {
  // Clear the database between tests
  await firebase.clearFirestoreData({ projectId: PROJECT_ID });
};

export const teardown = async () => {
  Promise.all(firebase.apps().map((app) => app.delete()));
};

// const faker = require('faker'); // https://github.com/marak/faker.js
// export const fakeEntries = async () => {
//     let entries = Array(20).fill(0);
//     for (const entry of entries) {
//         await getAdminFirestore().collection(`dictionaries/dictID/words`).add({
//             username: faker.internet.userName(),
//             avatar: faker.internet.avatar(),
//             bio: faker.hacker.phrase()
//         })
//     }
// }

beforeEach(async () => {
  await clearFirestore();
  // await fakeEntries();
});

afterAll(async () => {
  await teardown();
});

test('foo', async () => {
  await getAdminFirestore().doc('users/123').set({ id: 123, name: 'John' });
  expect(true).toBe(true);
});
