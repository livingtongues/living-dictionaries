# Provenance: copy of tutor's ~/code/tutor/alignment/src/align/alignment/core.py
# (chunked-emission + one global forced_align — see tutor's
# .knowledge/architecture/alignment.md for the memory-ceiling insight behind it).
import sys
from typing import List, Tuple
from .config import SAMPLE_RATE
from .types import SingleWord

# Wav2Vec2 stride at 16 kHz -> 50 Hz emission framerate
SAMPLES_PER_FRAME = 320

# Bound peak memory at ~1.4 GB for any audio length (with fp16 on cuda).
DEFAULT_CHUNK_SECONDS = 60.0
DEFAULT_OVERLAP_SECONDS = 5.0


def load_aligner(device="cpu"):
    """Load MMS_FA model, tokenizer, and aligner. Returns (model, tokenizer, aligner)."""
    import torch
    from torchaudio.pipelines import MMS_FA as bundle

    torch_device = torch.device(device)
    model = bundle.get_model()
    model.to(torch_device)
    if torch_device.type == "cuda":
        model = model.half()
    tokenizer = bundle.get_tokenizer()
    aligner = bundle.get_aligner()
    return model, tokenizer, aligner


def chunked_emission(
    *,
    waveform,
    model,
    device: str,
    chunk_seconds: float = DEFAULT_CHUNK_SECONDS,
    overlap_seconds: float = DEFAULT_OVERLAP_SECONDS,
):
    """Run the Wav2Vec2 model forward in overlapping audio windows and
    concatenate the (trimmed) emission outputs.

    Each window's emission is trimmed to drop the overlap pad on each side so
    the concatenation is gap- and overlap-free. The overlap exists purely so
    the model has proper attention context at every frame.

    Returns (emission_fp32 [1, T, V], total_samples). For audio shorter than
    `chunk_seconds` this degenerates to a single forward pass — no overhead.
    """
    import torch

    is_half = next(model.parameters()).dtype == torch.float16
    wf = waveform.to(device)
    if is_half:
        wf = wf.half()

    chunk_samples = int(chunk_seconds * SAMPLE_RATE)
    overlap_samples = int(overlap_seconds * SAMPLE_RATE)
    total_samples = wf.size(1)

    pieces = []
    offset = 0
    while offset < total_samples:
        chunk_end = min(offset + chunk_samples, total_samples)
        slice_start = max(0, offset - overlap_samples)
        slice_end = min(total_samples, chunk_end + overlap_samples)
        piece = wf[:, slice_start:slice_end]

        emission_piece, _ = model(piece)
        if is_half:
            emission_piece = emission_piece.float()

        leading_trim_frames = (offset - slice_start) // SAMPLES_PER_FRAME
        trailing_trim_frames = (slice_end - chunk_end) // SAMPLES_PER_FRAME
        if trailing_trim_frames > 0:
            emission_piece = emission_piece[:, leading_trim_frames:-trailing_trim_frames, :]
        elif leading_trim_frames > 0:
            emission_piece = emission_piece[:, leading_trim_frames:, :]
        pieces.append(emission_piece)

        offset = chunk_end

    emission = torch.cat(pieces, dim=1)
    del pieces
    return emission, total_samples


def align_words(
    waveform,
    words: List[SingleWord],
    start_second: float,
    model,
    tokenizer,
    aligner,
    device: str = "cpu",
    chunk_seconds: float = DEFAULT_CHUNK_SECONDS,
    overlap_seconds: float = DEFAULT_OVERLAP_SECONDS,
) -> List[SingleWord]:
    """Align `words` to `waveform` and add `start_ms`/`end_ms` to each one
    that has a non-empty `align_form`. Mutates `words` in place; also returns
    them. Words without an align_form (punctuation, coverage gaps) come back
    untimed."""
    import torch

    alignable = [(i, word) for i, word in enumerate(words) if word.get("align_form")]
    if not alignable:
        return words

    normalized_transcript = [word["align_form"] for _, word in alignable]

    try:
        with torch.inference_mode():
            emission, _ = chunked_emission(
                waveform=waveform,
                model=model,
                device=device,
                chunk_seconds=chunk_seconds,
                overlap_seconds=overlap_seconds,
            )
            token_spans = aligner(emission[0], tokenizer(normalized_transcript))
            num_frames = emission.size(1)

        for span_index, (word_index, _) in enumerate(alignable):
            start_ms, end_ms = _word_timestamps(start_second, waveform, token_spans[span_index], num_frames)
            words[word_index]["start_ms"] = start_ms
            words[word_index]["end_ms"] = end_ms

        for word in words:
            word.pop("align_form", None)
        return words
    except Exception as error:
        print(f"Error in alignment: {error}", file=sys.stderr)
        return []


def _word_timestamps(start_second: float, waveform, spans, num_frames: int) -> Tuple[int, int]:
    ratio = waveform.size(1) / num_frames
    x0 = int(ratio * spans[0].start)
    x1 = int(ratio * spans[-1].end)
    start_ms = int((start_second + (x0 / SAMPLE_RATE)) * 1000)
    end_ms = int((start_second + (x1 / SAMPLE_RATE)) * 1000)
    return start_ms, end_ms
