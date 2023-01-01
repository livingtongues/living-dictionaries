# Firebase Functions Emulator (INCOMPLETE/OUTDATED Documentation)

Demonstrates how to write Cloud Firestore + Cloud Functions **unit tests** and observe changes using the Firebase Emulator Suite.

## Geting Set Up

- `cd functions` and `npm install`
- Install the [Firebase CLI](https://firebase.google.com/docs/cli) globally. `npm i -g firebase-tools`
- `firebase login`
- `firebase use default` to use the dev project
- Check if you have Java installed (required for Firebase Emulator), run `java -version`, if not see https://java.com/en/download/help/download_options.xml to install

## Run Tests

- To run an single test using the command line, simply preface the test name with jest, as in `jest onNewUser.emulator`
- To use the Firebase Emulator UI at the same time as testing you can run `npm run serve` to get the database and cloud functions emulators running and then run the desired test in another terminal, for example: `jest makeUppercase.emulator --watch`

## Ways to test Cloud Functions

- Via test runner
- Using online database
- Using offline testing utilities
- Open Emulator, modify files and watch triggered functions (if applicable)

## Create New Jest Test

1. To ensure everything is working, create a basic test like so:
```js
test('foo', () => {
  expect(true).toBe(true);
})
```
2. Make changes to your \*.test.ts file and then run the appropriate testing command.

See https://jestjs.io/docs/en/getting-started for tips

---

## References consulted

- https://github.com/firebase/quickstart-testing
- https://firebase.google.com/docs/functions/unit-testing && https://github.com/firebase/functions-samples/blob/master/quickstarts/uppercase/functions/test/test.offline.js
- https://firebase.google.com/docs/functions/local-emulator
- https://firebase.google.com/docs/emulator-suite
- https://fireship.io/lessons/testing-cloud-functions-in-firebase/
- The Local Firebase Emulator UI in 15 minutes: https://www.youtube.com/watch?v=pkgvFNPdiEs
- https://github.com/ssagga/firebase-emulators-testing-with-jest
- https://firebase.google.com/docs/emulator-suite/connect_and_prototype?database=RTDB && https://firebase.google.com/docs/emulator-suite/connect_functions#web
- https://firebase.google.com/docs/rules/unit-tests#database

## Connect emulator to frontend app

```js
firebase.initializeApp(yourFirebaseConfig);

if (location.hostname === "localhost") {

  firebase.firestore().settings({
    host: "localhost:8080",
    ssl: false
  });

  firebase.functions().useFunctionsEmulator("http://localhost:5001");
}
```

## Generate Fake Data Quickly

Paste code into browser console to quickly create 100 fake documents.

```js
(function () {
  const script = document.createElement('script');
  script.src =
    'https://cdnjs.cloudflare.com/ajax/libs/Faker/3.1.0/faker.min.js';
  document.body.appendChild(script);

  setTimeout(() => {
    faker.seed(23);

    const container = document.querySelector('.Firestore-actions');

    const btn = document.createElement('button');
    btn.innerHTML = 'Add 100 Users';
    btn.className = 'mdc-button mdc-button--unelevated';
    btn.onclick = async () => {
      Array(100)
        .fill(0)
        .forEach((_) => {
          firestore.collection('users').add(faker.helpers.createCard());
        });
    };

    container.appendChild(btn);

  }, 2000);
})();
```

Or automate script with Tampermonkey Chrome extension
