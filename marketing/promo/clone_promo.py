"""The promo ad's voiceover in the owner's own cloned voice, in the brisk,
chatty read of a Bangla sales ad (owner, 2026-09-28: "this type voice" — the
STYLE of his reference ad; the narrator of that ad is never cloned, only the
owner, who recorded marketing/trailer/recordings/me.* for this).

Same model as the teaser (marketing/trailer/clone_vo.py). The reference is the
owner's own energetic recording, prepared by prep_ref.py; the full 32 flow steps
(~8 min a line on this CPU) — 16 was tried and blurred the words.

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

# How words are SPELLED FOR THE MODEL, when its reading of the real spelling is
# wrong (owner, 2026-09-29: "টেলমোর এআই" and "বুস্টও" mispronounced). The screen
# still shows lines.json's text; only what the model reads changes. Longest first.
SAY = [
    ("টেলমোর এআই", "টেল মোর, এ আই"),
    ("এআই", "এ আই"),
    ("বুস্টও", "বুস্ট ও"),
]


def say(text):
    for written, spoken in SAY:
        text = text.replace(written, spoken)
    return text


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
    # 32 flow steps, the model's full quality: 16 halved the time but blurred
    # words (owner: accent and pronunciation "not perfect", 2026-09-29)
    mod.infer_process = functools.partial(mod.infer_process, nfe_step=32)
    model.config.speed = speed

    RAW.mkdir(parents=True, exist_ok=True)
    for line in todo:
        audio = np.asarray(model(say(line["text"]), ref_audio_path=ref_wav, ref_text=ref_text), dtype=np.float32)
        if np.abs(audio).max() > 1.5:
            audio = audio / 32768.0
        sf.write(RAW / f"{line['id']}.wav", audio, 24000)
        print(line["id"], f"{len(audio) / 24000:.2f}s", line["text"], flush=True)


if __name__ == "__main__":
    main()
