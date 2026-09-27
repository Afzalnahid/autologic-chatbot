"""The teaser's voiceover in the owner's own cloned voice (owner's choice,
2026-09-27: he sends a short recording instead of reading the lines).

Model: IndicF5 (ai4bharat, MIT licence, speaks Bangla), run on this machine's
CPU. It is gated on Hugging Face: the owner accepts its terms and puts his own
read token in .env.local as HF_TOKEN — this script reads it and never prints it.

Clone only a voice whose owner agreed to it. That is the owner's own voice here.

    .venv311/Scripts/python clone_vo.py            # all eight lines
    .venv311/Scripts/python clone_vo.py 01 05      # just these

Input:  recordings/me.<any>      the reference recording (5–15 s is best)
        recordings/me.txt        exactly what is said in it
Output: video/public/trailer/vo/NN.mp3 (+ lines.json durations), after a trailer
        treatment: slightly slower, a touch lower, cleaned and levelled.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
REC = HERE / "recordings"
TMP = HERE / "out" / "clone"
VO = ROOT / "video" / "public" / "trailer" / "vo"
LINES = HERE / "lines.json"


def token():
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if line.startswith("HF_TOKEN="):
            return line.split("=", 1)[1].strip().strip("'\"")
    sys.exit("HF_TOKEN is not in .env.local yet — see marketing/trailer/README.md")


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def reference():
    src = next((p for p in REC.glob("me.*") if p.suffix != ".txt"), None)
    if not src or not (REC / "me.txt").exists():
        sys.exit("need recordings/me.<audio> and recordings/me.txt")
    text = (REC / "me.txt").read_text(encoding="utf-8").strip()
    TMP.mkdir(parents=True, exist_ok=True)
    wav = TMP / "ref-full.wav"
    run("ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-af",
        "highpass=f=80,afftdn=nf=-25,loudnorm=I=-18:TP=-2", "-ar", "24000", "-ac", "1", str(wav))
    dur = float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(wav)).stdout)
    if dur <= 14:
        return str(wav), text
    # Longer than the model likes: keep whole sentences up to ~12 s. The pauses
    # between sentences are found in the audio and matched to the sentences in
    # the text, so the kept audio and the kept text still say the same thing.
    sentences = [s.strip() for s in re.split(r"(?<=[।!?.])\s+", text) if s.strip()]
    log = run("ffmpeg", "-i", str(wav), "-af", "silencedetect=noise=-35dB:d=0.3", "-f", "null", "-").stderr
    ends = [float(m) for m in re.findall(r"silence_start: ([\d.]+)", log)]
    if len(ends) + 1 < len(sentences):
        sys.exit(f"could not find the sentence pauses ({len(ends)} pauses, {len(sentences)} sentences) — send a 10-second clip instead")
    keep = max(k for k in range(1, len(sentences)) if ends[k - 1] <= 12.5) if ends[0] <= 12.5 else 1
    cut = TMP / "ref.wav"
    run("ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-t", f"{ends[keep - 1] + 0.15:.2f}", str(cut))
    return str(cut), " ".join(sentences[:keep])


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    want = set(sys.argv[1:])
    doc = json.loads(LINES.read_text(encoding="utf-8"))
    ref_wav, ref_text = reference()

    # The model's own code downloads more files with no token argument, so the
    # token goes in the environment where huggingface_hub looks for it.
    import os
    os.environ["HF_TOKEN"] = token()
    # New torchaudio reads audio through torchcodec, which needs FFmpeg DLLs this
    # machine does not have; the model only ever loads our reference WAV, so
    # soundfile reads it instead.
    import torch
    import torchaudio

    def _load(path, *args, **kwargs):
        data, sr = sf.read(path, dtype="float32", always_2d=True)
        return torch.from_numpy(data.T.copy()), sr

    torchaudio.load = _load
    from transformers import AutoModel  # heavy; only after the inputs check out
    model = AutoModel.from_pretrained("ai4bharat/IndicF5", trust_remote_code=True)

    VO.mkdir(parents=True, exist_ok=True)
    for line in doc["lines"]:
        if want and line["id"] not in want:
            continue
        text = line["text"].replace("…", ", ")  # a pause the model can say
        audio = np.asarray(model(text, ref_audio_path=ref_wav, ref_text=ref_text), dtype=np.float32)
        if audio.dtype == np.int16 or np.abs(audio).max() > 1.5:
            audio = audio / 32768.0
        raw = TMP / f"{line['id']}-raw.wav"
        sf.write(raw, audio, 24000)
        out = VO / f"{line['id']}.mp3"
        # the trailer read: 7% slower, ~1 semitone lower, cleaned, trimmed, levelled
        run("ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-af",
            "asetrate=24000*0.944,aresample=24000,atempo=0.985,highpass=f=70,"
            "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
            "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
            "acompressor=threshold=-20dB:ratio=2.5,loudnorm=I=-16:TP=-1.5",
            "-ar", "44100", "-b:a", "160k", str(out))
        line["dur"] = round(float(run("ffprobe", "-v", "error", "-show_entries", "format=duration",
                                      "-of", "default=nw=1:nk=1", str(out)).stdout), 2)
        line["ext"] = "mp3"
        print(line["id"], f"{line['dur']}s", line["text"], flush=True)
    LINES.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
