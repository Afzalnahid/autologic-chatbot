"""The promo ad's voiceover in the owner's own cloned voice, in the brisk,
chatty read of a Bangla sales ad (owner, 2026-09-28: "this type voice" — the
STYLE of his reference ad; the narrator of that ad is never cloned, only the
owner, who recorded marketing/trailer/recordings/me.* for this).

Reuses the teaser's reference cut (marketing/trailer/clone_vo.py) and model.
Two changes from the teaser: the model speaks 8% faster itself (no stretching
afterwards), and it takes 16 flow steps instead of 32 — half the CPU time for a
barely audible difference.

    ../trailer/.venv311/Scripts/python clone_promo.py          # every line not done yet
    ../trailer/.venv311/Scripts/python clone_promo.py 05 11    # just these (redo)

Output: out/raw/NN.wav (24 kHz, untreated) — polish_promo.py finishes them.
"""
import functools
import json
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "trailer"))
import clone_vo  # noqa: E402  (reference() and token())

RAW = HERE / "out" / "raw"


def reference():
    """The owner's energetic recording, prepared by prep_ref.py (denoised,
    levelled, cut to whole sentences, ~14 s): out/hype-ref.wav + hype-ref.txt.
    The clone copies the reference's delivery as well as its voice — the first
    cut sounded calm because the teaser's reference was a calm voice note
    (owner, 2026-09-28). Without a prepared reference, the teaser's is used.
    Returns (wav, text, speed): an energetic reference already has the pace."""
    wav, txt = HERE / "out" / "hype-ref.wav", HERE / "out" / "hype-ref.txt"
    if wav.exists() and txt.exists():
        return str(wav), txt.read_text(encoding="utf-8").strip(), 1.0
    return (*clone_vo.reference(), 1.08)

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    want = set(sys.argv[1:])
    lines = json.loads((HERE / "lines.json").read_text(encoding="utf-8"))["lines"]
    if want:
        todo = [l for l in lines if l["id"] in want]
    else:
        todo = [l for l in lines if not (RAW / f"{l['id']}.wav").exists()]
    if not todo:
        return print("every line is already made")
    ref_wav, ref_text, speed = reference()
    print("reference:", Path(ref_wav).name, f"speed {speed}", flush=True)
    os.environ["HF_TOKEN"] = clone_vo.token()
    import torch
    import torchaudio

    def _load(path, *args, **kwargs):
        data, sr = sf.read(path, dtype="float32", always_2d=True)
        return torch.from_numpy(data.T.copy()), sr

    torchaudio.load = _load
    from transformers import AutoModel
    model = AutoModel.from_pretrained("ai4bharat/IndicF5", trust_remote_code=True)
    mod = sys.modules[type(model).__module__]
    mod.infer_process = functools.partial(mod.infer_process, nfe_step=16)
    model.config.speed = speed

    RAW.mkdir(parents=True, exist_ok=True)
    for line in todo:
        audio = np.asarray(model(line["text"], ref_audio_path=ref_wav, ref_text=ref_text), dtype=np.float32)
        if np.abs(audio).max() > 1.5:
            audio = audio / 32768.0
        sf.write(RAW / f"{line['id']}.wav", audio, 24000)
        print(line["id"], f"{len(audio) / 24000:.2f}s", line["text"], flush=True)


if __name__ == "__main__":
    main()
