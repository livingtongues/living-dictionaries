import type { ExpandedEntry, GoalDatabaseEntry } from "@living-dictionaries/types";
import { expand_entry } from "./expand_entry";
import { init, locale, dictionary, addMessages } from 'svelte-i18n';

describe('expand_entry', () => {
  beforeEach(() => {
    dictionary.set({});
    locale.set(undefined);
  });

  const now = new Date().getTime();
  test('returns an object with easily readable field names', () => {
    const part_of_speech_abbrev = 'n';
    const part_of_speech_english = 'noun';

    const sdn_key = '1.1';
    const sdn_english = 'Sky, weather and climate';

    addMessages('en', {
      ps: { [part_of_speech_abbrev]: part_of_speech_english },
      sd: { [sdn_key]: sdn_english }
    })
    init({ fallbackLocale: 'en', initialLocale: 'en' });

    const database_entry: GoalDatabaseEntry = {
      id: '1',
      lx: 'house',
      lo1: 'lo1 form',
      lo2: 'lo2 form',
      lo3: 'lo3 form',
      lo4: 'lo4 form',
      lo5: 'lo5 form',
      ph: 'a?u',
      sn: [{
        gl: { en: 'foo' },
        ps: [part_of_speech_abbrev],
        sd: ['earth'],
        sdn: [sdn_key],
        xs: [{ en: 'baz', vn: 'foo' }],
        pfs: [{
          path: 'path',
          gcs: 'gcs',
          ab: 'Bob',
          ts: now,
          sc: 'sc',
          cr: 'cr',
        }],
        vfs: [{
          path: 'path',
          ab: 'Bob',
          ts: now,
          sp: ['sp1', 'sp2'],
          sc: 'sc',
          youtubeId: 'yt123',
          startAt: 25,
        }],
        nc: '1',
        de: 'bam',
      }],
      in: 'inter',
      mr: 'morph',
      pl: 'plural',
      va: 'variant',
      di: ['west', 'east'],
      nt: 'hi',
      sr: ['the source', 'another source'],
      sfs: [{
        path: 'path',
        ab: 'Bob',
        ts: now,
        sp: ['sp1', 'sp2'],
        sc: 'sc',
      }],
      ei: 'ei12',
      scn: ['marmillion', '<i>leticus</i> Johnson'],
      co: { points:[{coordinates: {latitude: 23, longitude: -93}}]}
    }

    const expanded_entry: ExpandedEntry = {
      id: '1',
      lexeme: 'house',
      local_orthography_1: 'lo1 form',
      local_orthography_2: 'lo2 form',
      local_orthography_3: 'lo3 form',
      local_orthography_4: 'lo4 form',
      local_orthography_5: 'lo5 form',
      phonetic: 'a?u',
      senses: [{
        glosses: { en: 'foo' },
        parts_of_speech: [part_of_speech_english],
        semantic_domains: ['earth', sdn_english],
        example_sentences: [{ en: 'baz', vn: 'foo' }],
        photo_files: [{
          fb_storage_path: 'path',
          specifiable_image_url: 'gcs',
          uid_added_by: 'Bob',
          timestamp: new Date(now),
          source: 'sc',
          photographer_credit: 'cr',
        }],
        video_files: [{
          fb_storage_path: 'path',
          uid_added_by: 'Bob',
          timestamp: new Date(now),
          speaker_ids: ['sp1', 'sp2'],
          source: 'sc',
          youtubeId: 'yt123',
          start_at_seconds: 25,
        }],
        noun_class: '1',
        definition_english: 'bam',
      }],
      interlinearization: 'inter',
      morphology: 'morph',
      plural_form: 'plural',
      variant: 'variant',
      dialects: ['west', 'east'],
      notes: 'hi',
      sources: ['the source', 'another source'],
      sound_files: [{
        fb_storage_path: 'path',
        uid_added_by: 'Bob',
        timestamp: new Date(now),
        speaker_ids: ['sp1', 'sp2'],
        source: 'sc',
      }],
      elicitation_id: 'ei12',
      scientific_names: ['marmillion', '<i>leticus</i> Johnson'],
      coordinates: {points:[{coordinates: {latitude: 23, longitude: -93}}]}
    }

    expect(expand_entry(database_entry)).toEqual(expanded_entry);
  });

  test('empty entry', () => {
    const database_entry: GoalDatabaseEntry = {};
    const expanded_entry: ExpandedEntry = {
      senses: [],
    };
    expect(expand_entry(database_entry)).toEqual(expanded_entry);
  });

  test('simple entry with sense but without custom sd', () => {
    const database_entry: GoalDatabaseEntry = {
      sn: [
        {
          gl: {
            en: 'Hi'
          }
        }
      ]
    };
    const expanded_entry: ExpandedEntry = {
      senses: [
        {
          glosses: {
            en: 'Hi',
          },
          semantic_domains: [],
        }
      ],
    };
    expect(expand_entry(database_entry)).toEqual(expanded_entry);
  });
});
