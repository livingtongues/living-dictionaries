// tslint:disable-next-line: no-implicit-dependencies
import * as TestFunctions from 'firebase-functions-test';

const devFirebaseConfig = {
    databaseURL: 'https://talking-dictionaries-dev.firebaseio.com',
    projectId: 'talking-dictionaries-dev',
    storageBucket: 'talking-dictionaries-dev.appspot.com',
}

const testFun = TestFunctions(devFirebaseConfig, 'service-account-dev.json');

// const prodFirebaseConfig = {
//     databaseURL: 'https://talking-dictionaries-alpha.firebaseio.com',
//     projectId: 'talking-dictionaries-alpha',
//     storageBucket: 'talking-dictionaries-alpha.appspot.com',
// }

// const testFun = TestFunctions(prodFirebaseConfig, 'service-account-prod.json');

export { testFun };