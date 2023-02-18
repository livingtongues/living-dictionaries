import type { ExpandedEntry, GoalDatabaseEntry } from "@living-dictionaries/types";
import { expand_entry } from "./expand_entry";

describe('expand_entry', () => {
  const now = new Date();
  test('returns an object with easily readable field names', () => {
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
        ps: ['n'],
        sd: ['earth'],
        sdn: ['1.1'],
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
          ts: now.getTime(),
          sp: ['sp1', 'sp2'],
          sc: 'sc',
          youtubeId: 'yt123'
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
    }

    const expanded_entry: ExpandedEntry = {
      id: '1',
      lexeme: 'house',
      local_orthagraphy_1: 'lo1 form',
      local_orthagraphy_2: 'lo2 form',
      local_orthagraphy_3: 'lo3 form',
      local_orthagraphy_4: 'lo4 form',
      local_orthagraphy_5: 'lo5 form',
      phonetic: 'a?u',
      senses: [{
        glosses: { en: 'foo' },
        // parts_of_speech: ['noun'], // TODO
        parts_of_speech: ['n'],
        // semantic_domains: ['earth', 'whatever 1.1 maps to'], // TODO
        semantic_domains: ['earth', '1.1'],
        example_sentences: [{ en: 'baz', vn: 'foo' }],
        photo_files: [{
          fb_storage_path: 'path',
          specifiable_image_url: 'gcs',
          uid_added_by: 'Bob',
          timestamp: now,
          source: 'sc',
          photographer_credit: 'cr',
        }],
        video_files: [{
          fb_storage_path: 'path',
          uid_added_by: 'Bob',
          timestamp: now,
          speaker_ids: ['sp1', 'sp2'],
          source: 'sc',
          youtubeId: 'yt123',
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
        timestamp: now,
        speaker_ids: ['sp1', 'sp2'],
        source: 'sc',
      }],
      elicitation_id: 'ei12',
    }

    expect(expand_entry(database_entry)).toEqual({ ...database_entry, ...expanded_entry });
  });
});
