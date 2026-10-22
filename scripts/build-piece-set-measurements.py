"""Собирает docs/piece-sets/measurements.json из сырых замеров + настроек стора.

Запуск:
    python3 scripts/build-piece-set-measurements.py

Сырые замеры берутся из docs/piece-sets/measurements.raw.json (их кладёт
measure_png.py / measure_svg_browser.js), настройки стора — из
src/stores/boardStore.ts (в этом скрипте продублированы, чтобы не тянуть
TypeScript-раннер).
"""

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs" / "piece-sets"

STANDARD_BOTTOM_GAP = 0.1
STANDARD_TOP_GAP = 0.1

# Конфигурация PIECE_SETS в src/stores/boardStore.ts
SETS = {
    "alpha": {
        "type": "svg",
        "heights": None,
        "artTop": {"default": 0.0977, "Q": 0.1387, "R": 0.1719, "B": 0.0762, "N": 0.0859, "P": 0.1758},
        "artBottom": {"default": 0.0996},
    },
    "pixel": {
        "type": "svg",
        "heights": None,
        "artTop": {"default": 0.0625, "P": 0.125},
        "artBottom": {"default": 0.0625, "P": 0.125},
    },
    "pixel2": {
        "type": "png",
        "heights": {"K": 0.9143, "Q": 0.9143, "R": 0.9143, "B": 0.9143, "N": 0.9143, "P": 0.7},
        "artTop": {"default": 0.0625},
        "artBottom": {"default": 0.0625},
    },
    "pixel3": {
        "type": "png",
        "heights": {"K": 0.88, "Q": 0.86, "R": 0.82, "B": 0.84, "N": 0.84, "P": 0.68},
        "artTop": {"default": 0},
        "artBottom": {"default": 0},
    },
    "tatiana": {
        "type": "svg",
        "heights": None,
        "artTop": {"default": 0.0996, "R": 0.1582, "P": 0.2227},
        "artBottom": {"default": 0.0996, "R": 0.1016},
    },
}


def pick(table, code):
    value = table.get(code[1])
    return value if isinstance(value, (int, float)) else table.get("default", 0)


def main():
    raw = json.loads((DOCS / "measurements.raw.json").read_text(encoding="utf-8"))

    out = {
        "description": "Замеры полей картинок фигур: artTop/artBottom — доли высоты картинки.",
        "method": {
            "png": "альфа-канал исходного PNG, nearest-neighbour (как при pixelated-рендере)",
            "svg": "растеризация в браузере (canvas 512x512), альфа-канал",
        },
        "model": {
            "standardBottomGap": STANDARD_BOTTOM_GAP,
            "standardTopGap": STANDARD_TOP_GAP,
            "bottomMargin": "STANDARD_BOTTOM_GAP - artBottom * height",
            "visibleHeight": "height * (1 - artTop - artBottom)",
            "topGap": "1 - STANDARD_BOTTOM_GAP - visibleHeight",
        },
        "sets": {},
    }

    for set_id, cfg in SETS.items():
        pieces = {}
        for code, measured in raw[set_id].items():
            height = (cfg["heights"] or {}).get(code[1], 1)
            art_top = pick(cfg["artTop"], code)
            art_bottom = pick(cfg["artBottom"], code)
            visible = height * (1 - art_top - art_bottom)
            pieces[code] = {
                "measuredArtTop": measured["artTop"],
                "measuredArtBottom": measured["artBottom"],
                "measuredContent": measured["content"],
                "canvas": measured["canvas"],
                "height": height,
                "artTop": art_top,
                "artBottom": art_bottom,
                "visibleHeight": round(visible, 4),
                "topGap": round(1 - STANDARD_BOTTOM_GAP - visible, 4),
                "bottomGap": STANDARD_BOTTOM_GAP,
            }
        out["sets"][set_id] = {
            "type": cfg["type"],
            "heights": cfg["heights"],
            "artTop": cfg["artTop"],
            "artBottom": cfg["artBottom"],
            "pieces": pieces,
        }

    (DOCS / "measurements.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("docs/piece-sets/measurements.json обновлён")


if __name__ == "__main__":
    main()
