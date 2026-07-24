# Provenance: copy of tutor's forced-aligner Modal app
# (~/code/tutor/alignment/src/align/modal_app/align.py), deployed separately as
# `ld-forced-aligner` under the same Modal account. This app is deliberately
# DUMB and stable: it accepts pre-romanized align_forms and knows nothing about
# scripts or dictionaries — all smarts live in the LD SvelteKit server.
#
# Deploy: cd alignment && uv run --extra modal modal deploy src/ld_align/modal_app/align.py
import modal
from typing import List
from pydantic import BaseModel

from ..types import SingleWord

align_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg")
    .pip_install(
        "torch==2.10.0",
        "torchaudio==2.10.0",
        "numpy==2.4.3",
        "requests==2.32.5",
    )
    .add_local_python_source("ld_align")
)

model_cache = modal.Volume.from_name("ld-alignment-model-cache", create_if_missing=True)

app = modal.App(name="ld-forced-aligner", image=align_image)


class AlignRequest(BaseModel):
    audio_url: str
    words: List[SingleWord]


with align_image.imports():
    from torchaudio.pipelines import MMS_FA as bundle
    import torch


@app.cls(
    image=align_image,
    gpu="A10G",
    enable_memory_snapshot=True,
    scaledown_window=15,
    max_containers=5,
    volumes={"/cache": model_cache},
)
@modal.concurrent(max_inputs=10)
class ForcedAlignment:
    @modal.enter(snap=True)
    def load(self):
        import os
        os.environ["TORCH_HOME"] = "/cache/torch"
        self.model = bundle.get_model()

    @modal.enter(snap=False)
    def setup(self):
        # fp16 on cuda — memory + 2x speedup; no measurable accuracy loss vs
        # fp32 for forced alignment.
        self.model.to("cuda").half()
        self.tokenizer = bundle.get_tokenizer()
        self.aligner = bundle.get_aligner()

    @modal.fastapi_endpoint(docs=True, method="POST")
    def align(self, request: AlignRequest):
        import requests
        import tempfile
        import os
        import time
        from fastapi import HTTPException
        from ld_align.audio import load_audio_as_waveform
        from ld_align.core import align_words

        if not request.audio_url:
            raise HTTPException(status_code=400, detail="No audio_url provided")
        if not request.words:
            raise HTTPException(status_code=400, detail="No words provided")

        response = requests.get(request.audio_url)
        response.raise_for_status()

        with tempfile.NamedTemporaryFile(delete=False, suffix=".audio") as temp_file:
            temp_file.write(response.content)
            temp_audio_path = temp_file.name

        try:
            start_time = time.time()
            waveform = load_audio_as_waveform(temp_audio_path)
            timestamped_words = align_words(
                waveform=waveform,
                words=list(request.words),
                start_second=0,
                model=self.model,
                tokenizer=self.tokenizer,
                aligner=self.aligner,
                device="cuda",
            )
            elapsed = round(time.time() - start_time, 2)
            print(f"Alignment took {elapsed}s")
            return {"timestamped_words": timestamped_words}
        except Exception as e:
            print(f"Error in alignment: {e}")
            raise HTTPException(status_code=500, detail=f"Alignment failed: {e}")
        finally:
            os.unlink(temp_audio_path)
