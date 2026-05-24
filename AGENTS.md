# Проект: GoChess

**Описание:** Шахматное веб-приложение для игры с друзьями в реальном времени и против бота.

##  Технологический стек
- **Frontend:** React 18 + TypeScript + Vite
- **Стили:** Tailwind CSS (ретро-пиксельная тема)
- **Шахматная логика:** `chess.js` (v1.0.0-beta.8) — валидация ходов, FEN, PGN
- **Отображение доски:** `react-chessboard` (v4.7.2)
- **Стейт-менеджмент:** Zustand (с persist middleware)
- **Backend / База данных:** Supabase (Auth, Realtime, PostgreSQL, Storage)
- **Бот:** Stockfish (Web Worker + WASM) — 3 уровня сложности
- **Маршрутизация:** React Router v6
- **Иконки:** lucide-react

## 📐 Архитектура проекта

```
src/
├── App.tsx                     # Роутинг: /, /game/:roomId, /bot, /settings
── main.tsx                    # Точка входа: BrowserRouter, ToastProvider
├── index.css                   # CSS-переменные, layout, board highlights
├── components/
│   ├── board/
│   │   └── ChessBoard.tsx      # Обёртка react-chessboard: кастомные фигуры, подсветка, drag
│   ├── AuthModal.tsx           # Модалка входа/регистрации (email + Google)
│   ├── Button.tsx              # Кнопки: primary, outline, draw, danger, success, ghost
│   ├── Card.tsx                # Карточка-контейнер с градиентом
│   ├── ConfirmDialog.tsx       # Диалог подтверждения действий
│   ├── ErrorBoundary.tsx       # React Error Boundary
│   ├── LoadingScreen.tsx       # Экран загрузки
│   ├── Modal.tsx               # Базовая модалка (overlay, escape, scroll lock)
│   ├── ReactionPicker.tsx      # Выбор эмодзи-реакции на клетку
│   ├── Toast.tsx               # Toast-уведомления (success, error, warning, info)
│   └── UserMenu.tsx            # Меню пользователя: аватар, настройки, выход
├── pages/
│   ├── LobbyPage.tsx           # Главная: хаб с тайлами (бот, игра, партии, игроки)
│   ├── GamePage.tsx            # Игра с соперником: доска, история, реакции
│   ├── BotPage.tsx             # Игра с ботом: доска, выбор уровня, история
│   └── SettingsPage.tsx        # Настройки: профиль, тема доски, набор фигур
├── stores/
│   ├── authStore.ts            # Zustand: user, isLoading
│   ├── boardStore.ts           # Zustand: selectedTheme, selectedPieceSet (persist)
│   ├── gameStore.ts            # Zustand: Chess instance, status, moves (persist)
│   └── reactionStore.ts        # Zustand: activeReactions, rate limiting
├── hooks/
│   ├── useAuth.ts              # Supabase auth: signIn, signUp, signOut, uploadAvatar
│   └── useBoardWidth.ts        # Измерение ширины контейнера доски (ResizeObserver + debounce)
├── lib/
│   ├── soundManager.ts         # Звуки: move, capture, check, checkmate, promote
│   └── supabase.ts             # Supabase client + isConfigured flag
└── types/
    └── index.ts                # TypeScript типы: Color, GameStatus, BotLevel, User, GameData
```

## 🎨 Дизайн-система (CSS-переменные)

Все переменные определены в `src/index.css`:

**Цвета:**
- `--bg` — основной фон (чёрный)
- `--accent-brand` (#a3c18f) — основной акцент (зелёный)
- `--danger` (#c15a5a), `--success` (#7eb87e) — статусные цвета
- `--text`, `--text-secondary` — текст
- `--border` — границы

**Размеры:**
- `--space-4` ... `--space-32` — отступы (4px — 32px)
- `--radius-4: 4px`, `--radius-8: 8px`, `--btn-radius: 8px` — скругления
- `--font-size-xs` ... `--font-size-xl` — размеры шрифта
- `--btn-height`, `--btn-height-lg` — высота кнопок

**Шахматная доска:**
- `--board-highlight-selected`, `--board-highlight-possible`, `--board-highlight-capture`
- `--board-last-move-outline`, `--board-check-outline`, `--board-check-glow`

**Layout:**
- `--game-layout-gap: 20px` — отступ между колонками
- `--game-main-column-width: 1100px` — ширина основной колонки
- `--game-side-column-width: 400px` — ширина боковой колонки
- `--board-min-size: 320px` — минимальный размер доски

## 📐 База Данных (Supabase)

### Таблицы

**`profiles`** — профили пользователей
- Связано с Supabase Auth (`auth.users`)

**`games`** — активные и завершённые партии
- `room_id` (PK) — уникальный ID комнаты
- `players` (JSON) — `{white, whiteName, black, blackName, whitePhotoURL, blackPhotoURL, invite}`
- `pgn` (text) — Portable Game Notation
- `fen` (text) — Forsyth–Edwards Notation, текущая позиция
- `game_state` (text) — `'active'` | `'game_over'`
- `message` (text) — причина окончания
- `last_move_time` (bigint) — время последнего хода
- `created_at` (bigint)
- `takeback_request` (JSON) — запрос отмены хода
- `draw_request` (JSON) — запрос ничьей
- `turn` (text) — чей ход (`'w'` / `'b'`)
- `resign` (text) — кто сдался (`'w'` / `'b'`)
- `reactions` (JSON[]) — эмодзи-реакции на доске
- `quick_phrase` (JSON) — быстрая фраза соперника
- `rematch_request` (JSON) — запрос реванша

**`user_presence`** — онлайн-статус
- `uid` (PK) — ID пользователя
- `is_online` (boolean)
- `last_seen_at` (bigint)
- `manual_status` (text) — ключ ручного статуса
- `manual_status_text` (text)
- `manual_status_expires_at` (bigint)
- `updated_at_ms` (bigint)

### RPC
- `join_game_player_with_color(p_room_id, p_uid, p_name, p_preferred_color)` — атомарное присоединение игрока к партии с выбором цвета

*Синхронизация:* Supabase Realtime channels для мгновенной передачи ходов, статусов и реакций.

##  Порядок загрузки

```
1. React 18 + ReactDOM
2. React Router v6 (BrowserRouter)
3. Supabase SDK v2 → lib/supabase.ts
4. Zustand stores (authStore, boardStore, gameStore, reactionStore)
5. hooks/useAuth.ts — подписка на auth state changes
6. components/Toast.tsx — ToastProvider обёртка
7. App.tsx — Routes: /, /game/:roomId, /bot, /settings
8. pages/LobbyPage.tsx — главная страница (точка входа)
```

##  Правила для ИИ-ассистента

При написании кода для этого проекта строго соблюдай следующие правила:

1. **Фокус на чистоте:** Пиши модульный, читаемый код. Разделяй логику шахмат (chess.js), интерфейс (react-chessboard) и работу с сетью (Supabase).
2. **Шаги (Step-by-Step):** Не пытайся написать всё приложение за один ответ. Решай задачу по частям, жди подтверждения работоспособности.
3. **Безопасность (RLS):** При написании SQL-миграций для Supabase всегда учитывай Row Level Security (RLS). Пользователи должны изменять только свои партии.
4. **Обработка ошибок:** Всегда оборачивай сетевые запросы к Supabase в `try/catch` и выводи понятные сообщения через `useToast()`.
5. **Состояние игры:** FEN-строка — единственный источник истины о состоянии доски. PGN — для истории ходов.
6. **Никаких заглушек:** Если пишешь функцию, пиши рабочую версию. Если нужен пакет, укажи команду установки.
7. **Zustand stores:** Используй Zustand для стейта. `gameStore` и `boardStore` используют `persist` middleware для localStorage.
8. **CSS-переменные:** Все стили используют CSS-переменные из `index.css`. Не хардкодь цвета и размеры.
9. **Звуки и уведомления:** Используй `soundManager.play()` для звуков и `useToast()` для сообщений. Не используй `alert()` или `console.log()` для пользовательского вывода.
10. **Supabase credentials:** URL и anon-ключ находятся в `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Никогда не коммить реальные ключи в репозиторий.
11. **TypeScript:** Проект на TypeScript. Не используй `any` без крайней необходимости. chess.js v1 имеет строгие типы.
12. **react-chessboard:** Библиотека требует числовой `boardWidth` проп для корректной работы. Используй хук `useBoardWidth` для измерения контейнера.

## 🐛 Известные баги (приоритет исправления)

| Приоритет | Файл | Описание |
|-----------|------|----------|
| 🔴 Крит | `useAuth.ts:115` | `uploadAvatar` вызывает `updateProfile` которая определена ниже — не доступна в замыкании |
| 🔴 Крит | `gameStore.ts` | `persist` с Chess instance — антипаттерн для мультиплеера, стейт должен приходить с сервера |
| 🟡 Сред | `BotPage.tsx:36-38` | Бот делает случайные ходы — уровни сложности (easy/medium/hard) не влияют на игру |
| 🟡 Сред | `ChessBoard.tsx:42,115` | `as any` касты для chess.js API — нужно обновить типы |
| 🟡 Сред | `gameStore.ts:149-160` | `undoMove` отменяет 1 ход, для takeback нужно отменить 2 хода (свой + соперника) |
| 🟢 Низ | `vite.config.ts:7` | Хардкод `base: '/gochess/'` — сломает локальный dev |

## ✅ Исправленные баги

| Баг | Файлы | Описание |
|-----|-------|----------|
| ✅ Доска маленького размера при загрузке | `useBoardWidth.ts`, `BotPage.tsx`, `GamePage.tsx`, `index.css` | `useLayoutEffect` заменён на `useEffect`, добавлен `stableWidth` с debounce 150ms и порогом 300px, убран `key={stableWidth}` (вызывал remount при resize), убраны `!important` хаки в CSS |
| ✅ Настройки недоступны без авторизации | `LobbyPage.tsx` | Добавлена кнопка-шестерёнка (lucide-react `<Settings />`) в хедер лобби, доступна всем пользователям |
| ✅ Hover-превью ходов | `ChessBoard.tsx` | Добавлен `hoveredSquare` стейт + `hoveredMoveDetails` мемо с verbose флагами + `onMouseEnter/Leave` на `customSquare` — при наведении на фигуру показываются доступные ходы с корректными цветами темы (точки для ходов, красные точки для взятий) |
| ✅ Drag-and-drop удалён | `App.tsx`, `ChessBoard.tsx` | Удалён `ChessboardDnDProvider`, `dragSquare` стейт, `handleDragBegin/End`, `onPieceDragBegin/End` пропсы, `snapToCursor`, `customPieces` с isDragging логикой. Оставлен только click-to-move + hover-превью ходов |
| ✅ Drag-and-drop визуал улучшен | `ChessBoard.tsx`, `index.css` | CSS-only подход: `customPieces` с `isDragging` (`transform: scale(1.05)` + усиленная тень), скрыт курсор при drag через `.board-container:active { cursor: none }`. БЕЗ drag-обработчиков (`onPieceDragBegin/End`, `setState`, `ref`) — предыдущие попытки с drag-обработчиками ломали react-dnd из-за re-render во время drag |
| ✅ Иконка настроек на всех страницах | `BotPage.tsx`, `LocalPage.tsx`, `GamePage.tsx` | Добавлена кнопка-шестерёнка (SVG gear icon) в хедер каждой страницы игры, ведёт на `/settings`. Стиль идентичен LobbyPage: `bg-white/5 hover:bg-white/10 rounded-full` |
| ✅ Пиксельный дизайн + dropdown меню | `index.css`, `Card.tsx`, `CustomSelect.tsx`, `Modal.tsx`, `Toast.tsx`, `AuthModal.tsx`, `SettingsPage.tsx`, `LobbyPage.tsx`, `BotPage.tsx`, `LocalPage.tsx`, `GamePage.tsx`, `SettingsDropdown.tsx` | CSS-переменные радиусов упрощены (`--radius-4: 4px`, `--radius-8: 8px`, `--btn-radius: 8px`), убраны `--radius-12/16/20/24`. `pixel-3d-tile` заменён на `pixel-tile` (без 3D эффекта). Все компоненты обновлены на `rounded-[var(--radius-8)]`. Тени упрощены (лёгкие `0_4px_12px`, `0_8px_24px`). Создан `SettingsDropdown` компонент для игровых страниц (выпадающее меню с темами и фигурами, анимация `dropdown-in`). Игровые страницы используют `<SettingsDropdown />` вместо навигации на `/settings` |
| ✅ Монохромная тема + обновление всех компонентов | `index.css`, `LoadingScreen.tsx`, `Modal.tsx`, `AuthModal.tsx`, `Card.tsx`, `SettingsDropdown.tsx`, `CustomSelect.tsx`, `Toast.tsx`, `ReactionPicker.tsx`, `UserMenu.tsx`, `Button.tsx`, `SettingsPage.tsx`, `BotPage.tsx`, `LocalPage.tsx`, `GamePage.tsx` | Все компоненты переведены на монохромную тему: чёрный фон (`var(--bg)`), зелёные акценты (`var(--accent-brand)`). Убраны все тени (`box-shadow: none`), градиенты заменены на сплошные цвета. `pixel-tile` обновлён: фон `var(--bg)`, границы зелёные. LoadingScreen: чёрный фон, зелёный заголовок, зелёные точки. Modal/AuthModal: чёрный фон, зелёные границы и лейблы. Button: упрощены стили, убраны градиенты и тени. UserMenu: чёрный фон, зелёные акценты. ReactionPicker: чёрный фон, зелёные границы. Toast/Card/SettingsDropdown/CustomSelect: чёрный фон, зелёные границы, без теней. История ходов: чёрный фон, зелёные границы. |

## 🚀 Запуск

```bash
# Установка зависимостей
npm install

# Копирование переменных окружения
cp .env.local.example .env.local

# Заполните .env.local вашими Supabase credentials:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key

# Запуск dev-сервера
npm run dev
```

Открой `http://localhost:5173` в браузере.

Для режима бота: `http://localhost:5173/bot`
Для игры по ссылке: `http://localhost:5173/game/<roomId>`

## 🗄 Миграции

SQL-миграции лежат в `supabase/migrations/`. При пуше в `main` Supabase GitHub Integration применяет их автоматически.

Формат имени: `<YYYYMMDDHHMMSS>_<description>.sql`

### Порядок работы при создании таблицы/политики

1. Создать файл `supabase/migrations/<timestamp>_<name>.sql`
2. Проверить миграцию через `supabase_execute_sql` (если MCP доступен)
3. Закоммитить и запушить — Supabase применит автоматически

### Важно

- **Никогда** не коммить сервисный ключ (`service_role`) в репозиторий
- **Всегда** включай RLS для новых таблиц

## 🤖 Multi-Agent System (CrewAI + Gemini CLI)

Автоматизирует разработку через 3 агентов: Архитектор → Кодер → Дизайнер.

### Требования
- Python 3.12 (3.14 несовместим с `tiktoken`)
- Gemini CLI: `npm install -g @google/gemini-cli`
- CrewAI: `python3.12 -m pip install crewai`

### Агенты
| Агент | Инструмент | Что делает |
|---|---|---|
| **Architect** | `ArchitectTool` → Gemini CLI | Анализирует задачу, пишет план в `.opencode/plan.md` |
| **Coder** | `CoderTool` | Показывает план, ждёт работы в OpenCode desktop, проверяет `tsc --noEmit` |
| **Designer** | `DesignerTool` → Gemini CLI | Проверяет изменения через git diff, пишет ревью в `.opencode/review.md` |

### Использование

```bash
# Только архитектор (план)
python3.12 agents/run.py --plan "твоя задача"

# Только кодер (после плана)
python3.12 agents/run.py --code

# Только дизайнер (ревью)
python3.12 agents/run.py --review

# Полный пайплайн (Architect → Coder → Designer)
python3.12 agents/run.py "твоя задача"
```

### Как это работает
1. **Architect** вызывает Gemini CLI с контекстом проекта, Gemini генерирует план.
2. **Coder** вызывает Ollama (локально) или Groq (облачно), генерирует код, применяет изменения, запускает `tsc --noEmit`.
3. **Designer** читает `git diff`, отправляет в Gemini CLI, получает ревью дизайна.

### Провайдеры для Coder

| Провайдер | Модель | Параметры | Описание |
|---|---|---|---|
| `ollama` | qwen2.5-coder:1.5b | 1.5B | Локально, без ключа, для мелочей |
| `groq` | qwen/qwen3-32b | 32B | Облачно, бесплатно (14 400 req/day) |

**Настройка Groq:**
1. Зарегистрироваться: https://console.groq.com (без карты)
2. Создать API-ключ
3. Добавить в `.env.local`: `GROQ_API_KEY=твой_ключ`

### Файлы
- `agents/orchestrator.py` — **Главный вход.** TUI-меню (rich + questionary). Выбор провайдера.
- `agents/run.py` — CLI-пайплайн. Флаги: `--groq`, `--plan`, `--code`, `--review`.
- `agents/tools/base.py` — `GeminiCLITool` (вызов Gemini CLI через subprocess)
- `agents/tools/architect_tool.py` — генерация плана через Gemini CLI
- `agents/tools/ollama_tool.py` — `OllamaTool` (HTTP-клиент для Ollama/Groq API)
- `agents/tools/coder_tool.py` — обёртка для `OllamaTool` + tsc
- `agents/tools/designer_tool.py` — ревью дизайна через Gemini CLI
