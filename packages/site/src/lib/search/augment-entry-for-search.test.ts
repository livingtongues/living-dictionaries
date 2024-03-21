import { complex } from '$lib/mocks/entries';
import { augment_entry_for_search, simplify_lexeme_for_search } from './augment-entry-for-search';

describe(augment_entry_for_search, () => {
  test('does not choke on undefineds', () => {
    augment_entry_for_search({senses: [{glosses: {}}]})
    const result_from_nothing = augment_entry_for_search({})
    expect(result_from_nothing).toMatchInlineSnapshot(`
      {
        "dialects": [],
        "glosses": [],
        "has_audio": false,
        "has_image": false,
        "has_noun_class": false,
        "has_part_of_speech": false,
        "has_plural_form": false,
        "has_semantic_domain": false,
        "has_speaker": false,
        "has_video": false,
        "lexeme_other": [],
        "parts_of_speech": [],
        "semantic_domains": [],
        "sentences": [],
        "speakers": [],
      }
    `)
  })

  test('underscores filters', () => {
    const result = augment_entry_for_search(complex)
    expect(result.dialects).toEqual(['Hill', 'Southern_Berm'])
    expect(result.speakers).toEqual(['Budra_Raspeda', 'random_speaker_id_123'])
    expect(result.semantic_domains).toEqual(['Animals', 'Insects_and_small_creatures', 'Flying_Mammals', 'Flying_Insects'])
    expect(result).toMatchInlineSnapshot(`
      {
        "dialects": [
          "Hill",
          "Southern_Berm",
        ],
        "glosses": [
          "common jay butterfly",
          "papillon jay commun",
          "this is a very long gloss to simulate that sort of situation where it is ridiculously long",
        ],
        "has_audio": true,
        "has_image": true,
        "has_noun_class": true,
        "has_part_of_speech": true,
        "has_plural_form": false,
        "has_semantic_domain": true,
        "has_speaker": true,
        "has_video": false,
        "id": "1",
        "interlinearization": "3SG-POSS sit-PROG",
        "lexeme": "(h)æg-ko gag=tǝnǝ nlaʔ-pog",
        "lexeme_other": [
          "local way of writing",
          "(h)ag-ko gag=tene nla?-pog",
        ],
        "local_orthography_1": "local way of writing",
        "morphology": "morphology",
        "notes": "recorded in 1998, <img src=x" onerror="alert('XSS Attack will be sanitized')">",
        "parts_of_speech": [
          "noun",
          "verb",
        ],
        "phonetic": "hæg-ko gag=tǝnǝ nlaʔ-pog",
        "scientific_names": [
          "Graphium doson",
        ],
        "semantic_domains": [
          "Animals",
          "Insects_and_small_creatures",
          "Flying_Mammals",
          "Flying_Insects",
        ],
        "senses": [
          {
            "example_sentences": [
              {
                "en": "Watch how the common jay butterfly flies.",
                "vn": "A vernacular sentence.",
              },
            ],
            "glosses": {
              "en": "common jay butterfly",
              "fr": "papillon jay commun",
              "il": null,
              "pt": "this is a very long gloss to simulate that sort of situation where it is ridiculously long",
            },
            "ld_semantic_domains_keys": [
              "1.5",
              "1.9",
            ],
            "noun_class": "1",
            "parts_of_speech_keys": [
              "n",
              "v",
            ],
            "photo_files": [
              {
                "fb_storage_path": "gta/images/local_import/6-Common-jay-1580859671358.JPG",
                "source": "local_import",
                "specifiable_image_url": "LGuBKhg7vuv5-aJcOdnb_ucOXLSCIR1Kjxrh70xRlaIHqWo-mWqfWUcH3Xznz63QsFZmkeVmoNN0PEXzSc0Jh4g",
                "timestamp": null,
              },
            ],
            "translated_ld_semantic_domains": [
              "Animals",
              "Insects and small creatures",
            ],
            "translated_parts_of_speech": [
              "noun",
              "verb",
            ],
            "write_in_semantic_domains": [
              "Flying Mammals",
              "Flying Insects",
            ],
          },
        ],
        "sentences": [
          "Watch how the common jay butterfly flies.",
          "A vernacular sentence.",
        ],
        "sound_files": [
          {
            "fb_storage_path": "gta/audio/local_import/Gta-Pkd-Dec13-Butterflies-common-jay-1580859671012.mp3",
            "source": "local_import",
            "speakerName": "Budra Raspeda",
            "timestamp": 2020-02-04T23:49:08.537Z,
          },
          {
            "fb_storage_path": "gta/audio/local_import/Gta-Pkd-Dec13-Butterflies-common-jay-1580859671012.mp3",
            "source": "local_import",
            "speaker_ids": [
              "random_speaker_id_123",
            ],
            "timestamp": 2020-02-04T23:49:08.537Z,
          },
        ],
        "sources": [
          "Some cool guy in the village",
        ],
        "speakers": [
          "Budra_Raspeda",
          "random_speaker_id_123",
        ],
      }
    `);
  });
});

describe(simplify_lexeme_for_search, () => {
  test('removes diacritics', () => {
    expect(simplify_lexeme_for_search('põsret')).toEqual('posret');
    expect(simplify_lexeme_for_search('akʰe:')).toEqual('akhe:');
  });
});
