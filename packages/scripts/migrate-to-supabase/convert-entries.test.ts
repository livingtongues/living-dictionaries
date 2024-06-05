import { convert_entries } from './convert-entries'

test(convert_entries, () => {
  const { success, todo } = convert_entries()
  expect(todo[0]).toMatchInlineSnapshot(`undefined`)
  expect(success.slice(0, 3)).toMatchInlineSnapshot(`
    [
      {
        "entry": {
          "createdAt": {
            "_nanoseconds": 510000000,
            "seconds": 1566882380,
          },
          "createdBy": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
          "di": "",
          "dictId": "80CcDQ4DRyiYSPIWZ9Hy",
          "dictionary_id": "80CcDQ4DRyiYSPIWZ9Hy",
          "gl": {
            "en": "but",
            "es": "pero",
          },
          "id": "0DyO0JQrRUVXPvVNLEyN",
          "in": "",
          "lo": "",
          "lx": "am",
          "nt": "(from Tehuelche25 ELAR)",
          "ph": "",
          "ps": "",
          "sd": [],
          "sf": {
            "ab": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
            "cr": "javier domingo",
            "mt": "6a72a8ee-0316-4f84-8bcb-ba78a611047e",
            "path": "audio/dict_80CcDQ4DRyiYSPIWZ9Hy/0DyO0JQrRUVXPvVNLEyN_1566882399481.mpeg",
            "sp": "S1iWVcWWCPmTMivF4ZwU",
            "ts": 1566882400796,
          },
          "updatedAt": {
            "_nanoseconds": 16000000,
            "seconds": 1566882410,
          },
          "updatedBy": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
          "xv": "",
        },
        "supa_data": {
          "audio_speakers": [
            {
              "audio_id": "use-crypto-uuid-in-real-thing_2",
              "created_at": "2019-08-27T05:06:40.796Z",
              "created_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
              "speaker_id": "S1iWVcWWCPmTMivF4ZwU",
            },
          ],
          "audios": [
            {
              "created_at": "2019-08-27T05:06:40.796Z",
              "created_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
              "id": "use-crypto-uuid-in-real-thing_2",
              "source": "javier domingo",
              "storage_path": "audio/dict_80CcDQ4DRyiYSPIWZ9Hy/0DyO0JQrRUVXPvVNLEyN_1566882399481.mpeg",
              "updated_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
            },
          ],
          "entry": {
            "created_at": "2019-08-27T05:06:20.000Z",
            "created_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
            "dictionary_id": "80CcDQ4DRyiYSPIWZ9Hy",
            "id": "0DyO0JQrRUVXPvVNLEyN",
            "lexeme": {
              "default": "am",
            },
            "notes": {
              "default": "(from Tehuelche25 ELAR)",
            },
            "updated_at": "2019-08-27T05:06:50.000Z",
            "updated_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
          },
          "photos": [],
          "senses": [
            {
              "created_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
              "entry_id": "0DyO0JQrRUVXPvVNLEyN",
              "glosses": {
                "en": "but",
                "es": "pero",
              },
              "id": "use-crypto-uuid-in-real-thing_1",
              "updated_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
            },
          ],
          "sentences": [],
          "videos": [],
        },
      },
      {
        "entry": {
          "createdAt": {
            "_nanoseconds": 205000000,
            "seconds": 1563066691,
          },
          "createdBy": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
          "di": "",
          "dictionary_id": "80CcDQ4DRyiYSPIWZ9Hy",
          "gl": {
            "en": "I am at home",
            "es": "estoy en casa",
          },
          "id": "0TYQFijKXreNufDckoOb",
          "in": "",
          "lo": "",
          "lx": "e eeu sh pekk",
          "nt": "",
          "ph": "ˌje̞ːwʃəˈpe̞kʼ",
          "ps": [
            "phr",
          ],
          "sd": [],
          "sf": {
            "ab": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
            "cr": "javier domingo",
            "mt": "aef3783e-ad17-4066-b0d1-848733a16aef",
            "path": "audio/dict_80CcDQ4DRyiYSPIWZ9Hy/0TYQFijKXreNufDckoOb_1563066718050.mpeg",
            "sp": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
            "ts": 1563066719603,
          },
          "updatedAt": {
            "_nanoseconds": 41000000,
            "seconds": 1563066717,
          },
          "updatedBy": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
          "xv": "",
        },
        "supa_data": {
          "audio_speakers": [
            {
              "audio_id": "use-crypto-uuid-in-real-thing_4",
              "created_at": "2019-07-14T01:11:59.603Z",
              "created_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
              "speaker_id": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
            },
          ],
          "audios": [
            {
              "created_at": "2019-07-14T01:11:59.603Z",
              "created_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
              "id": "use-crypto-uuid-in-real-thing_4",
              "source": "javier domingo",
              "storage_path": "audio/dict_80CcDQ4DRyiYSPIWZ9Hy/0TYQFijKXreNufDckoOb_1563066718050.mpeg",
              "updated_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
            },
          ],
          "entry": {
            "created_at": "2019-07-14T01:11:31.000Z",
            "created_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
            "dictionary_id": "80CcDQ4DRyiYSPIWZ9Hy",
            "id": "0TYQFijKXreNufDckoOb",
            "lexeme": {
              "default": "e eeu sh pekk",
            },
            "phonetic": "ˌje̞ːwʃəˈpe̞kʼ",
            "updated_at": "2019-07-14T01:11:57.000Z",
            "updated_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
          },
          "photos": [],
          "senses": [
            {
              "created_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
              "entry_id": "0TYQFijKXreNufDckoOb",
              "glosses": {
                "en": "I am at home",
                "es": "estoy en casa",
              },
              "id": "use-crypto-uuid-in-real-thing_3",
              "parts_of_speech": [
                "phr",
              ],
              "updated_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
            },
          ],
          "sentences": [],
          "videos": [],
        },
      },
      {
        "entry": {
          "createdAt": {
            "_nanoseconds": 949000000,
            "seconds": 1566885777,
          },
          "createdBy": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
          "di": "",
          "dictionary_id": "80CcDQ4DRyiYSPIWZ9Hy",
          "gl": {
            "en": "to feel sleepy",
            "es": "tener sueño",
          },
          "id": "0iGltpW1CqgJEtNtKUod",
          "in": "",
          "lo": "",
          "lx": "kootteneshm",
          "nt": "(from Tehuelche25 ELAR)",
          "ph": "",
          "ps": [
            "v",
          ],
          "sd": [],
          "sf": {
            "ab": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
            "cr": "javier domingo",
            "mt": "2fa832c9-5cc1-419a-a3e0-97434db5829b",
            "path": "audio/dict_80CcDQ4DRyiYSPIWZ9Hy/0iGltpW1CqgJEtNtKUod_1566885797636.mpeg",
            "sp": "S1iWVcWWCPmTMivF4ZwU",
            "ts": 1566885799061,
          },
          "updatedAt": {
            "_nanoseconds": 267000000,
            "seconds": 1566885808,
          },
          "updatedBy": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
          "xv": "",
        },
        "supa_data": {
          "audio_speakers": [
            {
              "audio_id": "use-crypto-uuid-in-real-thing_6",
              "created_at": "2019-08-27T06:03:19.061Z",
              "created_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
              "speaker_id": "S1iWVcWWCPmTMivF4ZwU",
            },
          ],
          "audios": [
            {
              "created_at": "2019-08-27T06:03:19.061Z",
              "created_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
              "id": "use-crypto-uuid-in-real-thing_6",
              "source": "javier domingo",
              "storage_path": "audio/dict_80CcDQ4DRyiYSPIWZ9Hy/0iGltpW1CqgJEtNtKUod_1566885797636.mpeg",
              "updated_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
            },
          ],
          "entry": {
            "created_at": "2019-08-27T06:02:57.000Z",
            "created_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
            "dictionary_id": "80CcDQ4DRyiYSPIWZ9Hy",
            "id": "0iGltpW1CqgJEtNtKUod",
            "lexeme": {
              "default": "kootteneshm",
            },
            "notes": {
              "default": "(from Tehuelche25 ELAR)",
            },
            "updated_at": "2019-08-27T06:03:28.000Z",
            "updated_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
          },
          "photos": [],
          "senses": [
            {
              "created_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
              "entry_id": "0iGltpW1CqgJEtNtKUod",
              "glosses": {
                "en": "to feel sleepy",
                "es": "tener sueño",
              },
              "id": "use-crypto-uuid-in-real-thing_5",
              "parts_of_speech": [
                "v",
              ],
              "updated_by": "Wr77x8C4e0PI3TMqOnJnJ7VmlLF3",
            },
          ],
          "sentences": [],
          "videos": [],
        },
      },
    ]
  `)
  expect(success).toHaveLength(100)
})
