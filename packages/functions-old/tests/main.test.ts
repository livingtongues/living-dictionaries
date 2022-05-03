/// <reference types="jest" />

import { testFun } from './test-config';
testFun.cleanup;

import { db } from '../src/config';

test('Firestore is initialized', () => {
    expect(db).toBeDefined();
});

