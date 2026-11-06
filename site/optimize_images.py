"""Convierte las capturas PNG (site/.shots-raw) en WebP de dos tamaños para la web.

    python site/optimize_images.py

Cada captura sale en 1200 px (pantallas normales y móviles) y 2160 px (pantallas
de alta densidad); la página elige con srcset. WebP pesa 5–10 veces menos que PNG.
"""

import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
RAW = HERE / ".shots-raw"
OUT = HERE / "src" / "assets" / "shots"
WIDTHS = (1200, 2160)
QUALITY = 82

# La consola de Windows no siempre usa UTF-8.
sys.stdout.reconfigure(encoding="utf-8")
OUT.mkdir(parents=True, exist_ok=True)
pngs = sorted(RAW.glob("*.png"))
if not pngs:
    raise SystemExit(f"No hay capturas en {RAW}: ejecuta antes «node site/capture.mjs».")

for png in pngs:
    with Image.open(png) as image:
        image = image.convert("RGB")
        for width in WIDTHS:
            height = round(image.height * width / image.width)
            resized = image.resize((width, height), Image.Resampling.LANCZOS)
            target = OUT / f"{png.stem}-{width}.webp"
            resized.save(target, "WEBP", quality=QUALITY, method=6)
            print(f"✓ {target.name}  {target.stat().st_size // 1024} KB")
