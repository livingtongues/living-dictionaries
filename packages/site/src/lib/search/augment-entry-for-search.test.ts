import { complex } from '$lib/mocks/entries';
import { augment_entry_for_search } from './augment-entry-for-search';

describe(augment_entry_for_search, () => {
  test('underscores filters', () => {
    const result = augment_entry_for_search(complex)
    expect(result.dialects).toEqual(['Hill', 'Southern_Berm'])
    expect(result).toMatchInlineSnapshot(`
      {
        "coordinates": undefined,
        "deletedAt": undefined,
        "dialects": [
          "Hill",
          "Southern_Berm",
        ],
        "elicitation_id": undefined,
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
        "local_orthography_1": "local way of writing",
        "local_orthography_2": undefined,
        "local_orthography_3": undefined,
        "local_orthography_4": undefined,
        "local_orthography_5": undefined,
        "morphology": "morphology",
        "notes": "recorded in 1998, <img src=x" onerror="alert('XSS Attack will be sanitized')">",
        "parts_of_speech": [
          "noun",
          "verb",
        ],
        "phonetic": "hæg-ko gag=tǝnǝ nlaʔ-pog",
        "plural_form": undefined,
        "scientific_names": [
          "Graphium doson",
        ],
        "semantic_domains": [
          "Universe_and_the_natural_world",
          "Universe_and_the_natural_world",
        ],
        "senses": [
          {
            "definition_english": undefined,
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
                "photographer_credit": undefined,
                "source": "local_import",
                "specifiable_image_url": "LGuBKhg7vuv5-aJcOdnb_ucOXLSCIR1Kjxrh70xRlaIHqWo-mWqfWUcH3Xznz63QsFZmkeVmoNN0PEXzSc0Jh4g",
                "timestamp": null,
                "uid_added_by": undefined,
              },
            ],
            "translated_ld_semantic_domains": [
              "Universe and the natural world",
              "Universe and the natural world",
            ],
            "translated_parts_of_speech": [
              "noun",
              "verb",
            ],
            "video_files": undefined,
            "write_in_semantic_domains": [
              "Flying Mammals",
              "Flying Insects",
            ],
          },
        ],
        "sound_files": [
          {
            "fb_storage_path": "gta/audio/local_import/Gta-Pkd-Dec13-Butterflies-common-jay-1580859671012.mp3",
            "source": "local_import",
            "speakerName": "Budra Raspeda",
            "speaker_ids": undefined,
            "timestamp": 2020-02-04T23:49:08.537Z,
            "uid_added_by": undefined,
          },
        ],
        "sources": [
          "Some cool guy in the village",
        ],
        "speakers": [],
        "variant": undefined,
      }
    `);
  });
});
