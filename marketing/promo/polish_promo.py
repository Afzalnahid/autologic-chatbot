"""Studio polish for the promo's cloned lines (out/raw/NN.wav from clone_promo.py).

The same clean-up as the teaser's polish_vo.py — DeepFilterNet 3 denoise, then a
voiceover EQ — but for a bright, close, chatty sales read instead of a trailer:
no slowing down, no hall, a little more presence, tighter compression.
Writes video/public/promo/vo/NN.wav and each line's length into lines.json.

    ../trailer/.venv311/Scripts/python polish_promo.py        # every raw line
    ../trailer/.venv311/Scripts/python polish_promo.py 05     # just this one
    ../trailer/.venv311/Scripts/python polish_promo.py --voice Puck   # a Gemini voice → vo-puck/
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
    # 48 kHz first: a 24 kHz input (a Gemini take, which skips the denoiser that
    # resamples) cannot hold the exciter's 16 kHz ceiling and the chain output nothing
    "aresample=48000",
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
    args = sys.argv[1:]
    # --voice NAME: a stock (Gemini) voice — raw from out/gemini/NAME, polished into
    # video/public/promo/vo-name/ with its lengths in durations.json there; no
    # denoise (a TTS take has no room noise, and the filter would only dull it).
    voice = args[args.index("--voice") + 1] if "--voice" in args else None
    want = {a for a in args if a != "--voice" and a != voice}
    raw_dir = HERE / "out" / "gemini" / voice if voice else RAW
    vo_dir = VO.parent / f"vo-{voice.lower()}" if voice else VO
    doc = json.loads(LINES.read_text(encoding="utf-8"))
    durs_file = vo_dir / "durations.json"
    durs = json.loads(durs_file.read_text(encoding="utf-8")) if durs_file.exists() else {}
    model, state = (None, None) if voice else init_df()[:2]
    vo_dir.mkdir(parents=True, exist_ok=True)
    for line in doc["lines"]:
        raw = raw_dir / f"{line['id']}.wav"
        if (want and line["id"] not in want) or not raw.exists():
            continue
        clean = raw
        if model:
            x, sr = sf.read(raw, dtype="float32", always_2d=True)
            t = AF.resample(torch.from_numpy(x.mean(axis=1))[None], sr, state.sr())
            clean = raw_dir / f"{line['id']}-clean.wav"
            sf.write(clean, enhance(model, state, t)[0].numpy(), state.sr())
        out = vo_dir / f"{line['id']}.wav"
        run("ffmpeg", "-y", "-loglevel", "error", "-i", str(clean), "-af", CHAIN, "-ar", "48000", "-ac", "1", str(out))
        dur = round(float(run("ffprobe", "-v", "error", "-show_entries", "format=duration",
                              "-of", "default=nw=1:nk=1", str(out)).stdout), 2)
        if voice:
            durs[line["id"]] = dur
        else:
            line["dur"] = dur
        print(line["id"], f"{dur}s", flush=True)
    if voice:
        durs_file.write_text(json.dumps(durs, indent=1) + "\n", encoding="utf-8")
    else:
        LINES.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
