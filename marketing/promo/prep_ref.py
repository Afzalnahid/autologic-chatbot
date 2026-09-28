"""Prepares the owner's energetic recording as the clone's reference.

The clone copies the reference's delivery as well as its voice, so the owner
recorded the ~30 s script in marketing/promo/recordings/hype.txt in the
reference ad's upbeat style (owner, 2026-09-28). This:
  1. removes the room noise with DeepFilterNet 3 and levels it — the model
     reproduces whatever is in the reference, hiss included;
  2. keeps whole sentences from the start, up to ~14 s (the model's sweet spot).
     There is no speech recogniser here, so each sentence's end is ESTIMATED
     from its share of the text and snapped to the nearest real pause; the
     script prints how far each snap moved, so a bad match is visible.
Writes out/hype-clean.wav (the whole take, cleaned), out/hype-ref.wav (24 kHz,
the cut) and out/hype-ref.txt (exactly what the cut says). clone_promo.py uses them.

    ../trailer/.venv311/Scripts/python prep_ref.py
"""
import re
import subprocess
import sys
import types
from pathlib import Path

import soundfile as sf
import torch

_backend, _common = types.ModuleType("torchaudio.backend"), types.ModuleType("torchaudio.backend.common")
_common.AudioMetaData = type("AudioMetaData", (), {})
sys.modules.setdefault("torchaudio.backend", _backend)
sys.modules.setdefault("torchaudio.backend.common", _common)
import torchaudio.functional as AF  # noqa: E402
from df.enhance import enhance, init_df  # noqa: E402

HERE = Path(__file__).resolve().parent
REC = HERE / "recordings"
OUT = HERE / "out"
MAX_REF = 14.5


def run(*args):
    for attempt in range(4):  # this machine's ffmpeg sometimes dies with 0xC0000005
        try:
            return subprocess.run(args, check=True, capture_output=True, text=True, encoding="utf-8")
        except subprocess.CalledProcessError:
            if attempt == 3:
                raise


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    src = next(p for p in REC.glob("hype.*") if p.suffix != ".txt")
    text = (REC / "hype.txt").read_text(encoding="utf-8").strip()
    OUT.mkdir(exist_ok=True)

    raw = OUT / "hype-raw.wav"
    run("ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-af", "highpass=f=70", "-ar", "48000", "-ac", "1", str(raw))
    model, state, _ = init_df()
    x, sr = sf.read(raw, dtype="float32", always_2d=True)
    t = AF.resample(torch.from_numpy(x.mean(axis=1))[None], sr, state.sr())
    den = OUT / "hype-den.wav"
    # at most 18 dB of noise taken out: full-strength denoise leaves a faint metallic
    # edge, and the clone copies it (owner: "not crystal clear", 2026-09-29)
    sf.write(den, enhance(model, state, t, atten_lim_db=18)[0].numpy(), state.sr())
    clean = OUT / "hype-clean.wav"
    # level it and give it a little presence; no heavy compression, the ups and downs ARE the expression
    run("ffmpeg", "-y", "-loglevel", "error", "-i", str(den), "-af",
        "equalizer=f=230:t=q:w=1:g=-2,equalizer=f=3000:t=q:w=1.2:g=2,highshelf=f=8000:g=2,"
        "loudnorm=I=-18:TP=-1.5:LRA=11,alimiter=limit=0.9", "-ar", "48000", str(clean))

    log = run("ffmpeg", "-i", str(clean), "-af", "silencedetect=noise=-38dB:d=0.25", "-f", "null", "-").stderr
    starts = [float(v) for v in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(v) for v in re.findall(r"silence_end: ([\d.]+)", log)]
    pauses = [(s, e) for s, e in zip(starts, ends)]
    dur = float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(clean)).stdout)
    speech0 = pauses[0][1] if pauses and pauses[0][0] < 0.05 else 0.0
    speech1 = pauses[-1][0] if pauses and pauses[-1][1] > dur - 0.05 else dur
    inner = [p for p in pauses if p[0] > speech0 + 0.1 and p[1] < speech1 - 0.1]

    sentences = [s.strip() for s in re.split(r"(?<=[।!?])\s+", text) if s.strip()]
    weight = lambda s: len(re.sub(r"[\s,।!?]", "", s)) + 3  # letters, plus a breath per sentence
    total = sum(weight(s) for s in sentences)
    acc, cuts = 0, []
    for s in sentences[:-1]:
        acc += weight(s)
        guess = speech0 + (speech1 - speech0) * acc / total
        best = min(inner, key=lambda p: abs((p[0] + p[1]) / 2 - guess))
        cuts.append(best)
        print(f"after “{s[:24]}…”  guess {guess:5.2f}s → pause {best[0]:5.2f}–{best[1]:5.2f}s  (moved {abs((best[0] + best[1]) / 2 - guess):.2f}s)")
    keep = max((k for k in range(1, len(sentences)) if cuts[k - 1][0] - speech0 <= MAX_REF), default=1)
    end = cuts[keep - 1][0] + 0.12
    ref = OUT / "hype-ref.wav"
    run("ffmpeg", "-y", "-loglevel", "error", "-i", str(clean), "-ss", f"{max(0, speech0 - 0.1):.2f}", "-to", f"{end:.2f}",
        "-ar", "24000", "-ac", "1", str(ref))
    ref_text = " ".join(sentences[:keep])
    (OUT / "hype-ref.txt").write_text(ref_text + "\n", encoding="utf-8")
    print(f"reference: {end - speech0:.1f}s, {keep} sentences: {ref_text}")


if __name__ == "__main__":
    main()
