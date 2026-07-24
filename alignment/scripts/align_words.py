#!/usr/bin/env python3
"""Local CPU forced alignment — the dev/self-host counterpart of the
`ld-forced-aligner` Modal app, same contract.

Reads a JSON request on stdin:
    { "audio_path": "/abs/path/to/clip.mp3",
      "words": [{ "text": "...", "align_form": "..." }, ...] }
(`audio_url` is also accepted — it's downloaded first.)

Writes JSON to stdout:
    { "timestamped_words": [{ "text": "...", "start_ms": 0, "end_ms": 100 }, ...] }

Progress/errors go to stderr. Run via:
    uv run --extra local scripts/align_words.py < request.json
First run downloads the ~1.2 GB MMS_FA checkpoint into torch's cache.
"""
import json
import sys
import time


def main():
    request = json.load(sys.stdin)
    words = request.get("words") or []
    if not words:
        print(json.dumps({"timestamped_words": []}))
        return

    audio_path = request.get("audio_path")
    if not audio_path and request.get("audio_url"):
        import tempfile
        import requests

        response = requests.get(request["audio_url"])
        response.raise_for_status()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".audio") as temp_file:
            temp_file.write(response.content)
            audio_path = temp_file.name
    if not audio_path:
        print("No audio_path or audio_url provided", file=sys.stderr)
        sys.exit(1)

    from ld_align.audio import load_audio_as_waveform
    from ld_align.core import load_aligner, align_words

    print("Loading MMS_FA model on cpu...", file=sys.stderr)
    model, tokenizer, aligner = load_aligner(device="cpu")
    waveform = load_audio_as_waveform(audio_path)

    start = time.time()
    timestamped_words = align_words(
        waveform=waveform,
        words=words,
        start_second=0,
        model=model,
        tokenizer=tokenizer,
        aligner=aligner,
        device="cpu",
    )
    print(f"Aligned {len(words)} words in {round(time.time() - start, 2)}s", file=sys.stderr)
    print(json.dumps({"timestamped_words": timestamped_words}, ensure_ascii=False))


if __name__ == "__main__":
    main()
