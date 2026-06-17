# ♟ GoChess

Шахматное веб-приложение для игры с друзьями в реальном времени, против бота и вдвоём на одном устройстве.

## 🛠 Технологический стек

- **Frontend:** React 18 + TypeScript + Vite
- **Стили:** Tailwind CSS (ретро-пиксельная монохромная тема)
- **Шахматная логика:** PoisenChess Engine (собственный движок, perft-валидирован) — стандартная + Spell Chess
- **Отображение доски:** react-chessboard
- **Стейт-менеджмент:** Zustand (с persist middleware)
- **Backend / База данных:** Firebase (Auth, Firestore)
- **Бот:** Ichi — собственный ИИ (minimax + αβ + PST, Web Worker) — 4 уровня сложности
- **Маршрутизация:** React Router v6
- **VFX:** Пиксельные частицы на canvas (MagicVFX, PixelConfetti)

## ✨ Режимы игры

| Режим | Описание |
|-------|----------|
| **Онлайн** | Игра с другом по ссылке в реальном времени через Firestore |
| **Онлайн Spell Chess** | То же, но с заклинаниями (9 заклинаний, система зарядов) |
| **Бот** | 4 уровня сложности: Very Easy, Easy, Medium, Hard (Ichi minimax AI) |
| **Локальная классика** | Вдвоём на одном устройстве, «Авто-разворот» или «Лицом к лицу» |
| **Локальный рапид** | То же, но с шахматными часами (10 мин на партию) |
| **Локальный Spell Chess** | Магия вдвоём: 9 заклинаний, заряды, VFX |
| **Туман войны (Fog of War)** | Видны только свои фигуры и клетки под атакой |

### Spell Chess — 9 заклинаний

| Заклинание | Действие | Тип | Доступно |
|------------|----------|-----|----------|
| **Прыжок (jump)** | Перепрыгнуть свою фигуру | Free | Белым и чёрным |
| **Щит (shield)** | Защитить фигуру от заморозки/взрыва | Free | Белым и чёрным |
| **Портал (portal)** | Телепорт между двумя клетками | Free | Белым и чёрным |
| **Заморозка (freeze)** | Заморозить 3×3 область, ходы недоступны `[t10]` | Terminal | Белым и чёрным |
| **Взрыв (blast)** | Установить мину на клетку (взрывается через ход) `[t16]` | Terminal | Белым и чёрным |
| **Берсерк (berserk)** | Превратить свою фигуру в любую другую `[t7]` | Terminal | Только белым |
| **Благодать (divineGrace)** | Снять заморозку в радиусе 1 от цели | Terminal | Только белым |
| **Тень (shadowGrave)** | Пожертвовать свою фигуру и убить врага на той же клетке | Terminal | Только чёрным |
| **Мираж (mirage)** | Поменять местами две свои фигуры | Terminal | Только чёрным |

- Free-действия не заканчивают ход, Terminal — заканчивают
- Взятие короля = победа (нет шаха/мата/пата)
- Система зарядов вместо маны/кулдаунов
- Заклинания открываются по ходу игры (t7, t10, t16)

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
│   └── board/        # ChessBoard, ChessTimer
├── pages/            # Lobby, Game, Bot, Local, Spell, OfflineHub, OnlineHub, Settings
├── stores/           # Zustand stores (auth, game, board, reaction, spellGame)
├── hooks/            # useAuth, useBoardWidth, useGameSync, usePgnCopy
├── lib/
│   ├── engine/       # PoisenChess.ts, SpellChessEngine, factory, types (EngineAPI)
│   ├── bot/          # Ichi minimax AI + Web Worker
│   ├── firebase.ts
│   └── soundManager.ts
├── types/            # TypeScript типы
├── App.tsx           # Роутинг
└── main.tsx          # Точка входа
```

## 📱 PWA

Приложение можно установить на домашний экран (iOS/Android) для офлайн-игры против бота и локальных режимов.

## 📜 История изменений

### 3d604a6 — Online Spell Chess
- SpellChessEngine адаптирован под EngineAPI: undo, moves, history, сериализация
- `createEngine(mode, fen?)` для стандартного и магического режимов
- Синхронизация заклинаний онлайн через `spell_state_json` в Firestore
- Полный UI заклинаний в GamePage: VFX, панель с зарядами, прицеливание, берсерк-пикер, бомбы
- 9 заклинаний: freeze, jump, blast, shield, portal, berserk, divineGrace, shadowGrave, mirage

### 78ce960 — Spell Chess: заряды, action economy, 9 заклинаний
- Мана и кулдауны заменены на систему зарядов
- Free/Terminal action economy (jump/shield/portal не заканчивают ход)
- 3 новых заклинания: divineGrace, shadowGrave, mirage
- Разные наборы заклинаний для белых и чёрных
- SpellState сериализация, Perft-тесты

### b8100f5 — Слияние с upstream/main
42f8fc7 — EngineAPI: фабрика, интерфейс, рефакторинг useGameSync
- PoisenChess Engine (785 строк) заменяет chess.js
- EngineAPI интерфейс для всех режимов
- `useGameSync` декомпозирован на 4 хука (useGameTimer, useGameRequest, useRematch, useRoomJoin)
- Ichi bot (minimax+αβ+PST) заменяет Stockfish WASM (удалено 7MB)
- Stockfish и Supabase удалены из репозитория

### Предыдущие исправления
- Монохромная тема, пиксельный дизайн, унификация статус-бара
- Интегрированный пикер превращения пешки на доске
- Исправлен бесконечный LoadingScreen в GamePage
- Исправлена загрузка последних партий в лобби (сортировка на клиенте)
- Drag-and-drop удалён (click-to-move + hover-превью)
- Настройки доступны без авторизации
- Hover-превью ходов с корректными цветами темы

## 🐛 Известные ограничения

- Google OAuth через `signInWithPopup` не работает на GitHub Pages (COOP-политика). Используйте email/password.
- Spell Chess: PGN возвращает пустую строку (не реализован)
- Тестовые файлы require `@testing-library/react` (не установлен в devDependencies)

## 📝 Лицензия

MIT
