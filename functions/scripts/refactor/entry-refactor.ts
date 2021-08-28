async function entryRefactor(db: FirebaseFirestore.Firestore) {
  try {
    // fetchWords('724ZI6JmhvLfnNiZU0Wp');
    db.collection('dictionaries')
      .get()
      .then((snapshot) => {
        snapshot.forEach((dictionary) => {
          console.log('--------------------Refactoring: ', dictionary.id);
          fetchWords(dictionary.id, db);
        });
      });
  } catch (error) {
    console.log('Refactor failed!', error);
  }
}

function fetchWords(dictionaryId: string, db: FirebaseFirestore.Firestore) {
  db.collection(`dictionaries/${dictionaryId}/words`)
    .get()
    .then((snapshot) => {
      snapshot.forEach(async (word) => {
        // await turnSDintoArray(dictionaryId, word.id, word.data(), db);
        // await refactorGloss(dictionaryId, word.id, word.data(), db);
      });
    });
}

const turnSDintoArray = async (
  dictionaryId: string,
  wordId: string,
  data: any,
  db: FirebaseFirestore.Firestore
) => {
  const entry = data;
  if (entry.sd && typeof entry.sd === 'string') {
    console.log('entry sd before: ', entry.sd);
    const emptyArray = [];
    emptyArray.push(entry.sd);
    entry.sd = emptyArray;
    console.log('entry sd after: ', entry.sd);
  } else if (entry.sd && entry.sd instanceof Array) {
    console.log('it is an array - do nothing');
  } else {
    delete entry.sd;
  }
  // eslint-disable-next-line no-useless-catch
  try {
    await db.collection(`dictionaries/${dictionaryId}/words`).doc(wordId).set(data);
  } catch (err) {
    throw err;
  }
  return true;
  // console.log(`${wordId}: `, entry.gl);
};

const refactorGloss = async (
  dictionaryId: string,
  wordId: string,
  data: any,
  db: FirebaseFirestore.Firestore
) => {
  // eslint-disable-next-line no-useless-catch
  try {
    const entry = data;
    console.log(entry.gl);
    for (const key in entry.gl) {
      if (key === 'English') {
        entry.gl['en'] = entry.gl[key];
        delete entry.gl[key];
      }
      if (key === 'Spanish') {
        entry.gl['es'] = entry.gl[key];
        delete entry.gl[key];
      }
      if (key === 'Español') {
        entry.gl['es'] = entry.gl[key];
        delete entry.gl[key];
      }
      if (key === 'Bahasa Indonesia') {
        entry.gl['id'] = entry.gl[key];
        delete entry.gl[key];
      }
      if (key === 'French') {
        entry.gl['fr'] = entry.gl[key];
        delete entry.gl[key];
      }
      if (key === 'Mandarin 官话') {
        entry.gl['cmn'] = entry.gl[key];
        delete entry.gl[key];
      }
    }
    await db.collection(`dictionaries/${dictionaryId}/words`).doc(wordId).set(data);
    return console.log(`${wordId}: `, entry.gl);
  } catch (err) {
    throw err;
  }
};
