import { get, writable } from 'svelte/store';
import type { Writable, Unsubscriber } from 'svelte/store';
import { browser } from '$app/env';
import type { IUser } from '$lib/interfaces';
import { setCookie } from '$lib/helpers/cookies';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';

import { db, firebaseApp } from '.';
import { docStore } from './stores';

const userKey = 'ld_firebase_user';
let denotedVisit = false;

function createUserStore() {
  const { subscribe, set } = writable<IUser>(null);
  let unsub: Unsubscriber;

  if (browser) {
    const auth = getAuth(firebaseApp);
    let cached = null;
    cached = JSON.parse(localStorage.getItem(userKey));
    set(cached);

    onAuthStateChanged(
      auth,
      (u) => {
        if (u) {
          const userStore = docStore<IUser>(`users/${u.uid}`, { log: true });
          unsub = userStore.subscribe((user) => {
            if (user) {
              set(user);
              cacheUser(user);
              !denotedVisit && denoteVisit(user);
            }
          });
        } else {
          set(null);
          removeCachedUser();
        }
      },
      (err) => console.error(err.message)
    );
  }

  const signOutFn = async (session: Writable<any>) => {
    const auth = getAuth();
    unsub && unsub();
    const sessionValue = get(session);
    sessionValue.user = null;
    session.set(sessionValue);
    await signOut(auth);
  };

  return {
    subscribe,
    signOut: signOutFn,
  };
}

export const user = createUserStore();

function cacheUser(user: IUser) {
  localStorage.setItem(userKey, JSON.stringify(user));
  const minimalUser: Partial<IUser> = {
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL || null,
  }; // Cookies are limited to 4kb, about 1,000-4000 characters
  setCookie('user', JSON.stringify(minimalUser), { 'max-age': 31536000 });
}

function removeCachedUser() {
  localStorage.removeItem(userKey);
  const yesterday = new Date(new Date());
  yesterday.setDate(yesterday.getDate() - 1);
  setCookie('user', null, { expires: yesterday });
}

async function denoteVisit(user: IUser) {
  try {
    // const Sentry = await import('@sentry/browser');
    // Sentry.setUser({ email: user.email, id: user.uid, username: user.displayName || 'unknown' });
    denotedVisit = true;
    await updateDoc(doc(db, 'users', user.uid), { lastVisit: serverTimestamp() });
  } catch (err) {
    console.error(err);
  }
}
