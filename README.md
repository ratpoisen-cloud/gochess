# ♟ GoChess

Шахматное веб-приложение для игры с друзьями в реальном времени, против бота и вдвоём на одном устройстве.

## 🛠 Технологический стек

- **Frontend:** React 18 + TypeScript + Vite
- **Стили:** Tailwind CSS (ретро-пиксельная монохромная тема)
- **Шахматная логика:** EngineAPI (единый интерфейс) — PoisenChess Engine (perft-валидирован) + SpellChess Engine (9 заклинаний) + AtomicChess Engine через фабрику `createEngine(mode, fen?)`
- **Отображение доски:** react-chessboard
- **Стейт-менеджмент:** Zustand (с persist middleware)
- **Backend / База данных:** Firebase (Auth, Firestore) — signInWithPopup / email+password
- **Бот:** Ichi — собственный ИИ (minimax + αβ + PST, Web Worker) — 4 уровня сложности
- **Маршрутизация:** React Router v6
- **VFX:** Пиксельные частицы на canvas (MagicVFX для заклинаний, PixelConfetti для побед)

## ✨ Режимы игры

| Режим | Описание |
|-------|----------|
| **Онлайн** | Игра с другом по ссылке в реальном времени через Firestore |
| **Онлайн Spell Chess** | То же, но с заклинаниями (9 заклинаний, система зарядов) |
| **Бот** | 4 уровня сложности: Very Easy, Easy, Medium, Hard (Ichi minimax AI) |
| **Локальная классика** | Вдвоём на одном устройстве, «Авто-разворот» или «Лицом к лицу» |
| **Локальный рапид** | То же, но с шахматными часами (10 мин на партию) |
| **Локальный Spell Chess** | Магия вдвоём: 9 заклинаний, заряды, VFX |
| **Atomic Chess** | Локальный Atomic Chess (взрыв при взятии) |
| **Туман войны (Fog of War)** | Видны только свои фигуры и клетки под атакой |

### Spell Chess — 9 заклинаний

| Заклинание | Действие | Тип | Unlock | Доступно |
|------------|----------|-----|--------|----------|
| **Прыжок (jump)** | Перепрыгнуть свою фигуру | Free | t1 | Белым и чёрным |
| **Щит (shield)** | Защитить фигуру от заморозки/взрыва | Free | t4 | Белым и чёрным |
| **Благодать (divineGrace)** | Снять заморозку в радиусе 1 | Terminal | t7 | Только белым |
| **Тень (shadowGrave)** | Пожертвовать + убить врага | Terminal | t7 | Только чёрным |
| **Мираж (mirage)** | Поменять местами две свои фигуры | Terminal | t7 | Только чёрным |
| **Заморозка (freeze)** | Заморозить 3×3 область на 2 хода | Terminal | t10 | Белым и чёрным |
| **Портал (portal)** | Двунаправленный телепорт (3 хода) | Free | t10 | Белым и чёрным |
| **Берсерк (berserk)** | Превратить свою фигуру в любую другую | Terminal | t13 | Только белым |
| **Взрыв (blast)** | Установить мину 3×3 (взрыв через ход) | Terminal | t16 | Белым и чёрным |

- Free-действия не заканчивают ход, Terminal — заканчивают
- Взятие короля = победа (нет шаха/мата/пата)
- Система зарядов вместо маны/кулдаунов (3× jump, 2× shield, 2× freeze, 1× portal, 1× blast, 1× berserk/divineGrace/shadowGrave/mirage)
- Заклинания открываются по ходу игры (t1, t4, t7, t10, t13, t16)

## 🚀 Запуск

```bash
npm install
npm run dev
```

Откройте [http://localhost:5173](http://localhost:5173).

## 🎨 Настройки

На странице **Settings** (`/settings`) доступны:
- **6 тем доски:** Forest, Ocean, Dark, Marble, Middle Earth, Chess.com
- **4 набора фигур:** Alpha, Chessnut, Pixel, Tatiana

Настройки сохраняются в `localStorage`.

## 📁 Структура проекта

```
src/
├── components/       # UI-компоненты (Button, Card, Modal, Toast, MagicVFX, PixelConfetti)
│   └── board/        # ChessBoard, ChessTimer, SpellBar, SpellTile, SpellInfoPanel
├── pages/            # Lobby, Game, Bot, Local, Spell, Atomic, OfflineHub, OnlineHub, Settings
├── stores/           # Zustand stores (auth, game, board, reaction, spellGame)
├── hooks/            # useAuth, useBoardWidth, useGameSync, usePgnCopy, useGameTimer, useGameRequest, useRematch, useRoomJoin
├── lib/
│   ├── engine/       # PoisenChess.ts, SpellChessEngine (via spells dir), AtomicChessEngine.ts, factory.ts, types.ts (EngineAPI)
│   ├── bot/          # Ichi minimax AI + Web Worker
│   ├── firebase.ts
│   └── soundManager.ts
├── types/            # TypeScript типы (Color, GameMode, GameData, Challenge)
├── App.tsx           # Роутинг
└── main.tsx          # Точка входа
```

## 📱 PWA

Приложение можно установить на домашний экран (iOS/Android) для офлайн-игры против бота и локальных режимов.

## 📜 История изменений

### 93db276 — Spell Bar: минимал, long press tooltip, click-outside deselect
- Тайлы заклинаний без фона и рамки — только иконки (70% от тайла)
- Long press (500ms) → тултип с описанием заклинания (SPELL_DETAILS)
- 1-й клик выбирает заклинание, 2-й отменяет, клик вне доски сбрасывает
- Панель соперника выглядит как у игрока (без упрощений)
- Заклинания отсортированы по ходу открытия (SPELL_UNLOCK)
- Статус-бар над панелью заклинаний; «Ваш ход» = `font-size-sm` (как имя)

### 3d863e7 — Онлайн Spell Chess: undo guard, persistent VFX, blast 3×3
- Undo скрыт в spell mode (ломал state)
- VFX заморозки/щита/портала/прыжка сохраняются после хода
- Взрыв — 3×3 (не крест 16 клеток)
- Bombs пропс для ChessBoard (мины)
- Stale-turn guard: сравнение `freshData.turn !== preMoveTurn`

### 511cb70 — Stale-turn guard fix + auth fixes
- Онлайн ходы не отклонялись как stale (сравнение preMoveTurn)
- signInWithPopup восстановлен (COOP-варнинг нефатален)
- Firestore rules для `__firestore_presence__`
- Deploy.yml → оба main и PoisenChess

### fd3ff3d — Spell Chess: codex механики
- freeze → 2 хода, portal → bidirectional, divineGrace → только свои
- unlock turn rebalance: berserk=13, blast=16, остальные=7
- Уникальные PNG иконки для всех 9 заклинаний

### 3d604a6 — Online Spell Chess
- SpellChessEngine адаптирован под EngineAPI: undo, moves, history, сериализация
- `createEngine(mode, fen?)` для стандартного и магического режимов
- Синхронизация заклинаний онлайн через `spell_state_json` в Firestore
- Полный UI заклинаний в GamePage: VFX, панель, прицеливание, берсерк-пикер, бомбы
- 9 заклинаний: freeze, jump, blast, shield, portal, berserk, divineGrace, shadowGrave, mirage

### 78ce960 — Spell Chess: заряды, action economy, 9 заклинаний
- Мана и кулдауны заменены на систему зарядов
- Free/Terminal action economy (jump/shield/portal не заканчивают ход)
- 3 новых заклинания: divineGrace, shadowGrave, mirage
- Разные наборы заклинаний для белых и чёрных

### 42f8fc7 — EngineAPI: фабрика, интерфейс, рефакторинг useGameSync
- PoisenChess Engine (784 строки) заменяет chess.js
- EngineAPI интерфейс для всех режимов
- `useGameSync` декомпозирован на 4 хука (useGameTimer, useGameRequest, useRematch, useRoomJoin)
- Ichi bot (minimax+αβ+PST) заменяет Stockfish WASM (удалено 7MB)
- AtomicChessEngine (117 строк) через фабрику

### Предыдущие исправления
- Монохромная тема, пиксельный дизайн, унификация статус-бара
- Интегрированный пикер превращения пешки на доске
- Исправлен бесконечный LoadingScreen в GamePage
- Исправлена загрузка последних партий в лобби (сортировка на клиенте)
- Drag-and-drop удалён (click-to-move + hover-превью)
- Настройки доступны без авторизации
- Hover-превью ходов с корректными цветами темы

## 🐛 Известные ограничения

- Google OAuth через `signInWithPopup` на GitHub Pages вызывает COOP-варнинг (нефатально). Используйте email/password.
- Spell Chess: PGN возвращает пустую строку (не реализован)
- Spell Chess: `moves()` verbose возвращает не-verbose формат
- Spell Chess: нет promotion для пешек
- Spell Chess: звуки заклинаний не реализованы (используют `'move'`)
- CI: TypeScript 5.5+ сужает типы после `===` в замыканиях — используйте `as string` или булевы константы
- Service Worker: 206 Partial Response при кэшировании аудио
- Тестовые файлы require `@testing-library/react` (не установлен в devDependencies)

## 📝 Лицензия

MIT
