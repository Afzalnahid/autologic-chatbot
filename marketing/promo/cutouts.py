"""Cut the people out of the stock photos (Pexels, free for commercial use) so
the ad can stand them on its own backgrounds, the way the reference ad does.

rembg with its u2net_human_seg model (MIT; the model downloads once, ~170 MB,
into ~/.u2net). Runs in its own environment, .venv-rembg, so it can never
upgrade a library under the voice model again.

    .venv-rembg/Scripts/python cutouts.py
Input:  video/public/promo/people/<id>.jpg
Output: video/public/promo/people/cut/<id>.png  (transparent, cropped to the person)
"""
import sys
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "video" / "public" / "promo" / "people"
OUT = SRC / "cut"
KEEP_WHOLE = {"6943442"}  # the night bedroom: used as a full picture, not a cutout


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    session = new_session("u2net_human_seg")
    for jpg in sorted(SRC.glob("*.jpg")):
        if jpg.stem in KEEP_WHOLE or (OUT / f"{jpg.stem}.png").exists():
            continue
        img = Image.open(jpg).convert("RGB")
        cut = remove(img, session=session, post_process_mask=True)
        cut = cut.crop(cut.getbbox())
        cut.save(OUT / f"{jpg.stem}.png")
        print(jpg.stem, cut.size, flush=True)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
