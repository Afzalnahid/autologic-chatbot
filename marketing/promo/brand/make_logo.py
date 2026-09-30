# The Autolinium logo the owner sent on 2026-09-30 (autolinium-logo-source.jpg:
# the blue gradient mark with its globe, "AUTOLINIUM" below, on white), made
# usable on dark video: the white is turned into transparency ("colour to
# alpha", so the soft edges and the globe's glow stay smooth) and saved as
# video/public/promo/brand/autolinium-logo.png. Only this stacked logo (mark
# over the word) is ever used (owner, 2026-09-30), never mark and word apart.
#   .venv-rembg\Scripts\python.exe brand\make_logo.py      (from marketing/promo)
from pathlib import Path
import numpy as np
from PIL import Image

here = Path(__file__).parent
out = here.parents[2] / "video/public/promo/brand"
src = np.asarray(Image.open(here / "autolinium-logo-source.jpg").convert("RGB")).astype(np.float32) / 255

# colour to alpha against white: the least-white channel decides how opaque a
# pixel is, and the colour is un-mixed from the white behind it
a = 1 - src.min(axis=2)
a = np.clip((a - 0.06) / 0.94, 0, 1)                # the jpeg's off-white haze goes fully clear
safe = np.maximum(a, 1e-4)[..., None]
rgb = np.clip((src - (1 - safe)) / safe, 0, 1)
rgba = np.dstack([rgb, a])

def crop(y0, y1, x0, x1, name):
    part = rgba[y0:y1, x0:x1]
    al = part[..., 3]
    ys, xs = np.nonzero(al > 0.04)
    part = part[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    img = Image.fromarray((part * 255).round().astype(np.uint8), "RGBA")
    img.save(out / name, optimize=True)
    print("wrote", out / name, img.size)

h, w = a.shape
crop(0, h, 0, w, "autolinium-logo.png")
