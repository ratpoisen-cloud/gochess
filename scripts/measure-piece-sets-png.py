"""Замеряет прозрачные поля картинок PNG-наборов (pixel2, pixel3).

PNG-наборы рисуются с `image-rendering: pixelated` (nearest-neighbour), поэтому
поля считаются по альфа-каналу ИСХОДНОГО файла, без растеризации: так границы
совпадают с тем, что реально видно на доске.

Запуск:
    python3 scripts/measure-piece-sets-png.py            # все PNG-наборы
    python3 scripts/measure-piece-sets-png.py pixel2     # только один набор

Результат печатается в stdout и пишется в docs/piece-sets/measurements.raw.json
(только PNG-наборы; SVG-наборы меряются в браузере — см. README.md).
"""

import json
import pathlib
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Нужен Pillow: pip install pillow")

ROOT = pathlib.Path(__file__).resolve().parents[1]
PIECES = ROOT / "public" / "pieces"
RAW = ROOT / "docs" / "piece-sets" / "measurements.raw.json"
CODES = ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"]
PNG_SETS = ["pixel2", "pixel3"]


def measure_set(set_id):
    result = {}
    for code in CODES:
        path = PIECES / set_id / f"{code}.png"
        if not path.exists():
            continue
        image = Image.open(path).convert("RGBA")
        width, height = image.size
        bbox = image.split()[3].getbbox()
        if bbox is None:
            result[code] = None
            continue
        result[code] = {
            "artTop": round(bbox[1] / height, 4),
            "artBottom": round((height - bbox[3]) / height, 4),
            "content": round((bbox[3] - bbox[1]) / height, 4),
            "canvas": f"{width}x{height}",
        }
    return result


def main():
    targets = sys.argv[1:] or PNG_SETS
    raw = json.loads(RAW.read_text(encoding="utf-8")) if RAW.exists() else {}
    for set_id in targets:
        measured = measure_set(set_id)
        raw[set_id] = measured
        print(f"=== {set_id}")
        for code, values in measured.items():
            print(
                f"  {code}: artTop {values['artTop']:.4f}  "
                f"artBottom {values['artBottom']:.4f}  content {values['content']:.4f}"
            )
    RAW.parent.mkdir(parents=True, exist_ok=True)
    RAW.write_text(json.dumps(raw, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"\nЗаписано: {RAW.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
