# Makes the Autolinium mark for dark video: the owner's navy-on-grey master
# (autolinium-mark-source.jpg, 1600 px) turned into a light-blue gradient on a
# transparent ground, like the dark-background lockup he showed (2026-09-29).
# Alpha comes from how dark each pixel is, so the globe's white continents
# become see-through, as in his dark version. Cropped to the mark's own edges.
#   .venv-rembg\Scripts\python.exe brand\make_mark.py
from pathlib import Path
import numpy as np
from PIL import Image

here = Path(__file__).parent
src = np.asarray(Image.open(here / "autolinium-mark-source.jpg").convert("RGB")).astype(np.float32)
lum = src @ np.array([0.299, 0.587, 0.114], np.float32)
bg, ink = np.percentile(lum, 95), np.percentile(lum, 3)
a = np.clip((bg - lum) / (bg - ink), 0, 1)
a = np.clip((a - 0.04) / 0.92, 0, 1)            # clean the jpeg haze at both ends
ys, xs = np.nonzero(a > 0.02)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
a = a[y0:y1, x0:x1]
h, w = a.shape
# diagonal gradient: light sky blue at the top right (by the globe) to a deeper blue at the bottom left
yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
k = np.clip(((h - yy) / h * 0.65 + xx / w * 0.35), 0, 1)[..., None]
top, low = np.array([110, 200, 255], np.float32), np.array([30, 110, 230], np.float32)
rgb = low + (top - low) * k
out = np.dstack([rgb, a[..., None] * 255]).round().astype(np.uint8)
img = Image.fromarray(out, "RGBA")
dst = here.parents[2] / "video/public/promo/brand/autolinium-mark-light.png"
img.save(dst, optimize=True)
print("wrote", dst, img.size)
