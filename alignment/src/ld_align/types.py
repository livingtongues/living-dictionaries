# Provenance: slim copy of tutor's alignment package
# (~/code/tutor/alignment/src/align/types.py) — keep the SingleWord contract in
# sync if tutor's ever changes (it hasn't since 2026-04).
from typing import TypedDict
from typing_extensions import NotRequired


class SingleWord(TypedDict):
    text: str
    align_form: NotRequired[str]
    start_ms: NotRequired[int]
    end_ms: NotRequired[int]
