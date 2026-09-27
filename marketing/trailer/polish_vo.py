"""Studio polish for the cloned voiceover.

The clone copies everything in the reference recording, the WhatsApp
compression and the room included, and the model itself outputs 24 kHz. So
each raw line (out/clone/NN-raw.wav from clone_vo.py) is:
  1. denoised with DeepFilterNet 3 (open source, runs on the CPU);
  2. given a voiceover chain: rumble cut, mud cut, presence and air lift, a soft
     exciter for the top end the 24 kHz model cannot make, de-essing, gentle
     compression, loudness to -16 LUFS and a limiter;
  3. slowed 5% for a trailer read, without changing the pitch (the earlier
     pitch-down resampled the voice and dulled it — owner: "quality is not
     professional", 2026-09-28).
Writes video/public/trailer/vo/NN.mp3 and the new lengths into lines.json.

    .venv311/Scripts/python polish_vo.py          # every line that has a raw take
    .venv311/Scripts/python polish_vo.py 01       # just this one
"""
import json
import subprocess
import sys
import types
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

# DeepFilterNet still imports a torchaudio module that newer torchaudio dropped;
# it only needs the name to exist.
_backend, _common = types.ModuleType("torchaudio.backend"), types.ModuleType("torchaudio.backend.common")
_common.AudioMetaData = type("AudioMetaData", (), {})
sys.modules.setdefault("torchaudio.backend", _backend)
sys.modules.setdefault("torchaudio.backend.common", _common)
import torchaudio.functional as AF  # noqa: E402
from df.enhance import enhance, init_df  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
RAW = HERE / "out" / "clone"
VO = ROOT / "video" / "public" / "trailer" / "vo"
LINES = HERE / "lines.json"

CHAIN = ",".join([
    "highpass=f=75",
    "equalizer=f=250:t=q:w=1.0:g=-3",     # mud
    "equalizer=f=3200:t=q:w=1.2:g=2.5",   # presence: the words
    "highshelf=f=8500:g=3",               # air
    "aexciter=amount=1.5:drive=6:blend=0:freq=6000:ceil=16000",
    "deesser=i=0.35",
    "atempo=0.95",
    "acompressor=threshold=-21dB:ratio=3:attack=6:release=110:makeup=2",
    "loudnorm=I=-16:TP=-1.5:LRA=6",
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
        raw = RAW / f"{line['id']}-raw.wav"
        if (want and line["id"] not in want) or not raw.exists():
            continue
        x, sr = sf.read(raw, dtype="float32", always_2d=True)
        t = AF.resample(torch.from_numpy(x.mean(axis=1))[None], sr, state.sr())
        clean = enhance(model, state, t)[0].numpy()
        den = RAW / f"{line['id']}-clean.wav"
        sf.write(den, np.clip(clean, -1, 1), state.sr())
        out = VO / f"{line['id']}.mp3"
        run("ffmpeg", "-y", "-loglevel", "error", "-i", str(den), "-af", CHAIN,
            "-ar", "48000", "-ac", "1", "-b:a", "192k", str(out))
        line["dur"] = round(float(run("ffprobe", "-v", "error", "-show_entries", "format=duration",
                                      "-of", "default=nw=1:nk=1", str(out)).stdout), 2)
        line["ext"] = "mp3"
        print(line["id"], f"{line['dur']}s", line["text"], flush=True)
    LINES.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
