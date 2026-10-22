# Наборы фигур: геометрия и замеры

Материалы по наборам фигур из `public/pieces/<id>/` — как считается положение
фигуры в клетке и откуда взяты числа в `src/stores/boardStore.ts`.

## Модель

У каждого набора в `PIECE_SETS` есть три поля:

| поле | смысл |
|---|---|
| `heights` | высота самой картинки в долях клетки (по типу `K`,`Q`,`R`,`B`,`N`,`P`). Нет поля — картинка занимает всю клетку (`height = 1`) |
| `artTop` | прозрачное поле сверху картинки (доля её высоты) |
| `artBottom` | прозрачное поле снизу картинки (доля её высоты) |

Из них считается видимая часть фигуры и отступы:

```
visibleHeight = height × (1 - artTop - artBottom)
bottomMargin  = STANDARD_BOTTOM_GAP - artBottom × height   // сдвиг картинки вверх (margin-bottom)
bottomGap     = bottomMargin + artBottom × height          // всегда STANDARD_BOTTOM_GAP
topGap        = 1 - STANDARD_BOTTOM_GAP - visibleHeight
```

`STANDARD_BOTTOM_GAP = 0.1` и `STANDARD_TOP_GAP = 0.1` — общая база всех
наборов (стандарт — Tatiana). Формулы живут в `src/stores/boardStore.ts`
(`getPieceBottomMargin`, `getPieceBottomGap`, `getPieceTopGap`), рендер —
в `src/components/board/ChessBoard.tsx` и `BoardPreview.tsx`.

## Замеры

`measurements.json` — машинно-читаемые замеры: сырые поля картинки, значения
из стора и производные отступы. `measurements.raw.json` — исходные данные
замеров (вход для скрипта сборки).

| набор | artTop | artBottom | height | видимая часть | отступ сверху | отступ снизу |
|---|---|---|---|---|---|---|
| alpha | 0.0762…0.1758 (по типу) | 0.0996 | 1 | 0.7246…0.8242 | 0.076…0.175 | 0.1 |
| pixel | 0.0625 (пешка 0.125) | 0.0625 (пешка 0.125) | 1 | 0.75…0.875 | 0.025 (пешка 0.15) | 0.1 |
| pixel2 | 0.0625 | 0.0625 | 0.9143 (пешка 0.7) | 0.6125…0.8 | 0.1 (пешка 0.2875) | 0.1 |
| pixel3 | 0 | 0 | 0.88…0.68 | 0.68…0.88 | 0.02…0.22 | 0.1 |
| tatiana | 0.0996 (R 0.1582, P 0.2227) | 0.0996 (R 0.1016) | 1 | 0.6777…0.8008 | 0.099 (R 0.16, P 0.222) | 0.1 |

Особенности наборов:

- **alpha / pixel / tatiana** — SVG, холст квадратный и не обрезан, поэтому
  высота картинки = клетка, а верх задаёт сама картинка.
- **pixel2** — PNG 16×16 с прозрачными полями по 1px (6.25%) сверху и снизу,
  поэтому высоты заданы явно: `0.9143` → видимая часть 80% клетки и отступ
  сверху 10% (как у Tatiana); пешка `0.7` → 61.25%, то есть на 30% меньше
  исходных 87.5%. Контур чёрных фигур — тёмно-серый `#585858` (вместо
  белого), внутренняя синяя тень `(53,54,88)` не тронута.
- **pixel3** — PNG обрезаны по контуру (`artTop`/`artBottom` = 0), рост задан
  явно: король 0.88 … пешка 0.68.

## Как перезамерить

```bash
# 1) PNG-наборы (точные поля по альфа-каналу исходника, nearest-neighbour)
python3 scripts/measure-piece-sets-png.py            # pixel2 + pixel3
python3 scripts/measure-piece-sets-png.py pixel2     # только один набор

# 2) SVG-наборы — в браузере:
#    npm run dev → открыть /local/classic → DevTools → Console →
#    вставить scripts/measure-piece-sets-svg.js и скопировать выведенный JSON
#    в docs/piece-sets/measurements.raw.json

# 3) пересобрать сводный файл (сырые замеры + настройки стора → measurements.json)
python3 scripts/build-piece-set-measurements.py
```

`measure_png.py` не растеризует картинку: PNG-наборы рисуются с
`image-rendering: pixelated`, поэтому границы считаются по альфа-каналу
исходного файла — иначе браузерное сглаживание «съест» по 1px с каждой стороны
и поля окажутся на ~3% меньше реальных.

Для SVG нужен браузер: `qlmanage` и другие системные растеризаторы неверно
применяют `transform` в SVG-наборах (`tatiana` в частности).

## Новый набор

1. Папка `public/pieces/<id>/` с 12 файлами `wK,wQ,wR,wB,wN,wP,bK,bQ,bR,bB,bN,bP`.
2. Запись в `PIECE_SETS` (`src/stores/boardStore.ts`): `path`, `pixelated` для
   растров, `heights`/`artTop`/`artBottom` — из замеров.
3. Замеры — в `docs/piece-sets/measurements.json` (собрать скриптом).
4. Тесты: `src/stores/__tests__/boardStore.test.ts` проверяет наличие файлов
   набора и геометрию (общая база 10%, отступ сверху, пешка pixel2).
