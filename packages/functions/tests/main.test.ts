import { testFun } from './test-config';
testFun.cleanup;

import { db } from '../src/config';

test.skip('Firestore is initialized', () => {
    expect(db).toBeDefined();
});

