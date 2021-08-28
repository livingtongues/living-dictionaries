const firebaseConfigDev = {
  apiKey: import.meta.env.VITE_FirebaseDevApiKey,
  authDomain: 'talking-dictionaries-dev.firebaseapp.com',
  databaseURL: 'https://talking-dictionaries-dev.firebaseio.com',
  projectId: 'talking-dictionaries-dev',
  storageBucket: 'talking-dictionaries-dev.appspot.com',
  messagingSenderId: '133947380807',
  appId: '1:133947380807:web:14ecf6ee014ed9900e0d62',
  measurementId: 'G-2ZX11TVD17',
};
// functionsURL: 'https://us-central1-talking-dictionaries-dev.cloudfunctions.net',

const firebaseConfigProd = {
  apiKey: 'AIzaSyDxagUh3Dhk89eVZhSFUNhNLeU1ue0msZ8',
  authDomain: 'talking-dictionaries-alpha.firebaseapp.com',
  databaseURL: 'https://talking-dictionaries-alpha.firebaseio.com',
  projectId: 'talking-dictionaries-alpha',
  storageBucket: 'talking-dictionaries-alpha.appspot.com',
  messagingSenderId: '215143435444',
  appId: '1:215143435444:web:924c5f7aee188083a8dbe1',
  measurementId: 'G-C8MLS69JTH',
};
// functionsURL: 'https://us-central1-talking-dictionaries-alpha.cloudfunctions.net',

export const firebaseConfig =
  import.meta.env.VITE_project === 'talking-dictionaries-alpha'
    ? firebaseConfigProd
    : firebaseConfigDev;
