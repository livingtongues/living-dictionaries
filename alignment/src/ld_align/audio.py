# Provenance: copy of tutor's ~/code/tutor/alignment/src/align/audio.py
# (minus the wav/slice helpers LD doesn't use). ffmpeg decodes ANY input
# format to 16 kHz mono pcm — mp3/wav/m4a/ogg all fine.
import subprocess
import numpy as np
from .config import SAMPLE_RATE


def get_audio_bytes(filepath: str) -> bytes:
    try:
        ffmpeg_command = [
            "ffmpeg",
            "-nostdin",
            "-threads", "0",
            "-i", filepath,
            "-f", "s16le",
            "-ac", "1",
            "-acodec", "pcm_s16le",
            "-ar", str(SAMPLE_RATE),
            "-",
        ]
        out = subprocess.run(ffmpeg_command, capture_output=True, check=True).stdout
        return out
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Failed to load audio: {e.stderr.decode()}") from e


def audio_bytes_to_waveform(audio_bytes: bytes):
    import torch

    int16_array = np.frombuffer(audio_bytes, np.int16)
    normalized = int16_array.flatten().astype(np.float32) / 32768.0
    waveform = torch.from_numpy(normalized).unsqueeze(0)
    return waveform


def load_audio_as_waveform(filepath: str):
    return audio_bytes_to_waveform(get_audio_bytes(filepath))
