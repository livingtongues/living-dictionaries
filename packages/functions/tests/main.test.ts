import { testFun } from './test-config';
testFun.cleanup();

import { db } from '../src/config';

test.skip('firestore is initialized', () => {
  expect(db).toBeDefined();
});

