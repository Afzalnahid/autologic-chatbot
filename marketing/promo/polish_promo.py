"""Studio polish for the promo's cloned lines (out/raw/NN.wav from clone_promo.py).

The same clean-up as the teaser's polish_vo.py — DeepFilterNet 3 denoise, then a
voiceover EQ — but for a bright, close, chatty sales read instead of a trailer:
no slowing down, no hall, a little more presence, tighter compression.
Writes video/public/promo/vo/NN.wav and each line's length into lines.json.

    ../trailer/.venv311/Scripts/python polish_promo.py        # every raw line
    ../trailer/.venv311/Scripts/python polish_promo.py 05     # just this one
"""
import json
import subprocess
import sys
import types
from pathlib import Path

import soundfile as sf
import torch

# DeepFilterNet imports a torchaudio module newer torchaudio dropped; the name is enough.
_backend, _common = types.ModuleType("torchaudio.backend"), types.ModuleType("torchaudio.backend.common")
_common.AudioMetaData = type("AudioMetaData", (), {})
sys.modules.setdefault("torchaudio.backend", _backend)
sys.modules.setdefault("torchaudio.backend.common", _common)
import torchaudio.functional as AF  # noqa: E402
from df.enhance import enhance, init_df  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RAW = HERE / "out" / "raw"
VO = ROOT / "video" / "public" / "promo" / "vo"
LINES = HERE / "lines.json"

CHAIN = ",".join([
    "highpass=f=85",
    "equalizer=f=230:t=q:w=1.0:g=-3.5",   # mud
    "equalizer=f=3000:t=q:w=1.2:g=3.5",   # presence: the words cut through the beat
    "highshelf=f=8000:g=3.5",             # air
    "aexciter=amount=1.5:drive=6:blend=0:freq=6000:ceil=16000",
    "deesser=i=0.4",
    "silenceremove=start_periods=1:start_threshold=-45dB",
    "areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
    "acompressor=threshold=-22dB:ratio=3.5:attack=4:release=90:makeup=2.5",
    "loudnorm=I=-16:TP=-1.5:LRA=5",
    "alimiter=limit=0.89",
])


def run(*args):
    # this machine's ffmpeg sometimes dies with 0xC0000005 for no reason; retry
    for attempt in range(4):
        try:
            return subprocess.run(args, check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError:
            if attempt == 3:
                raise


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    want = set(sys.argv[1:])
    doc = json.loads(LINES.read_text(encoding="utf-8"))
    model, state, _ = init_df()
    VO.mkdir(parents=True, exist_ok=True)
    for line in doc["lines"]:
        raw = RAW / f"{line['id']}.wav"
        if (want and line["id"] not in want) or not raw.exists():
            continue
        x, sr = sf.read(raw, dtype="float32", always_2d=True)
        t = AF.resample(torch.from_numpy(x.mean(axis=1))[None], sr, state.sr())
        clean = RAW / f"{line['id']}-clean.wav"
        sf.write(clean, enhance(model, state, t)[0].numpy(), state.sr())
        out = VO / f"{line['id']}.wav"
        run("ffmpeg", "-y", "-loglevel", "error", "-i", str(clean), "-af", CHAIN, "-ar", "48000", "-ac", "1", str(out))
        line["dur"] = round(float(run("ffprobe", "-v", "error", "-show_entries", "format=duration",
                                      "-of", "default=nw=1:nk=1", str(out)).stdout), 2)
        print(line["id"], f"{line['dur']}s", flush=True)
    LINES.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
