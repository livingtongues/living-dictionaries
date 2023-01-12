<script lang="ts">
  import { Story } from 'kitbook';
  import PrintEntry from './PrintEntry.svelte';

  const entry = {
        "sdn": [
          "1.5",
          "1.9"
        ],
        gl: {
          en: "EN butterfly",
          es: "ES something else",
        },
        "di": "Hill",
        "pf": {
          "path": "gta/images/local_import/6-Common-jay-1580859671358.JPG",
          "source": "local_import",
          "gcs": "LGuBKhg7vuv5-aJcOdnb_ucOXLSCIR1Kjxrh70xRlaIHqWo-mWqfWUcH3Xznz63QsFZmkeVmoNN0PEXzSc0Jh4g\n"
        },
        "sd": null,
        "sf": {
          "path": "gta/audio/local_import/Gta-Pkd-Dec13-Butterflies-common-jay-1580859671012.mp3",
          "ts": {
            "seconds": 1580859720,
            "nanoseconds": 994000000
          },
          "speakerName": "Budra Raspeda",
          "source": "local_import"
        },
        "createdBy": "OTD",
        "lx": "(h)æg-ko gag=tǝnǝ nlaʔ-pog",
        "id": "HUW1umElFA8Uvjww8VCb"
      }
</script>

<Story>
  <PrintEntry {entry} />
</Story>