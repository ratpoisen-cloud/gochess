# Проект: GoChess

**Описание:** Веб-приложение для игры в шахматы с друзьями в реальном времени.

## 🛠 Технологический стек
- **Frontend:** Vanilla JS (ES2020+) — модульная архитектура через `<script>` теги
- **Шахматная логика:** `chess.js` (0.10.3) — валидация ходов, FEN, PGN
- **Отображение доски:** `chessboard.js` (1.0.0) + jQuery 3.5.1
- **Backend / База данных:** Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Бот:** Stockfish 18 Lite (Web Worker + WASM)
- **PWA:** Service Worker, manifest.json

## 📐 Архитектура проекта

```
Testproject/
├── index.html              # Главная страница (PWA, единая точка входа)
├── js/
│   ├── app.js              # Инициализация, роутинг по URL (?room=, ?bot=1), загрузка модулей
│   ├── auth.js             # Авторизация (Google/Email через Supabase)
│   ├── game-core.js        # Лобби, создание/подключение к игре, реванш, удаление партий
│   ├── board-ui.js         # Доска: drag-and-drop, мобильные клики, подсветка, реакции
│   ├── bot-engine.js       # Stockfish Web Worker (3 уровня: easy/medium/hard)
│   ├── controls.js         # Кнопки: подтверждение хода, отмена, ничья, реванш, просмотр
│   ├── ui.js               # Обновление UI: статус хода, история, модалки окончания
│   ├── firebase.js         # Compat-слой: Firebase-style API (ref/get/set/onValue) → Supabase
│   ├── supabase-config.js  # Supabase client + auth-адаптер (Firebase-style: signInWithPopup и т.д.)
│   ├── presence.js         # Онлайн-статус, ручные статусы, heartbeat
│   ├── sound.js            # Звуки: ходы, взятия, мат, UI-кнопки
│   ├── themes.js           # Темы доски + UI темы (default/pixel)
│   ├── utils.js            # Утилиты: notify(), confirmAction(), isMobile, генерация ID
│   └── engine/             # Stockfish 18 Lite (stockfish-18-lite-single.js + .wasm)
├── css/
│   ├── style.css           # Главный CSS (импортирует все остальные)
│   ├── base.css            # Базовые переменные, сброс, шрифты
│   ├── layout.css          # Сетка, top-bar, game-shell
│   ├── components.css      # Кнопки, модалки, тосты, карточки
│   ├── lobby.css           # Лобби: hub, списки игр, игроки
│   ├── game.css            # Игровой экран: доска, статус, история ходов
│   ├── board-themes.css    # Темы доски: classic, forest, ocean, dark, marble, middle-earth
│   ├── account-themes.css  # UI темы аккаунта
│   ├── profile.css         # Профиль пользователя, аватар
│   └── responsive.css      # Мобильная адаптивность
└── assets/                 # Звуки, фигуры (4 набора), лого, иконки PWA
```

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

## 🔄 Порядок загрузки скриптов

```
1. jQuery 3.5.1
2. chess.js 0.10.3
3. chessboard.js 1.0.0
4. Supabase SDK v2
5. js/supabase-config.js    → window.supabaseClient, auth-адаптеры
6. js/utils.js              → window.notify, window.confirmAction
7. js/sound.js              → window.SoundManager
8. js/themes.js             → window.setTheme, window.setUITheme
9. js/firebase.js           → window.ref, get, set, update, onValue, watchGame, watchGames
10. js/presence.js          → window.startPresenceLayer, window.getEffectivePresence
11. js/auth.js              → window.setupAuth
12. js/board-ui.js          → window.initBoard, window.handleDragStart, window.handleDrop
13. js/bot-engine.js        → window.createBotEngine
14. js/controls.js          → window.setupGameControls
15. js/ui.js                → window.updateUI, window.updateTurnIndicator
16. js/game-core.js         → window.initGame, window.initLobby, window.initBotGame
17. js/app.js               # Точка входа: DOMContentLoaded → инициализация всего
```

## 🤖 Правила для ИИ-ассистента

При написании кода для этого проекта строго соблюдай следующие правила:

1. **Фокус на чистоте:** Пиши модульный, читаемый код. Разделяй логику шахмат (chess.js), интерфейс (chessboard.js) и работу с сетью (Supabase).
2. **Шаги (Step-by-Step):** Не пытайся написать всё приложение за один ответ. Решай задачу по частям, жди подтверждения работоспособности.
3. **Безопасность (RLS):** При написании SQL-миграций для Supabase всегда учитывай Row Level Security (RLS). Пользователи должны изменять только свои партии.
4. **Обработка ошибок:** Всегда оборачивай сетевые запросы к Supabase в `try/catch` и выводи понятные сообщения через `window.notify()`.
5. **Состояние игры:** FEN-строка — единственный источник истины о состоянии доски. PGN — для истории ходов.
6. **Никаких заглушек:** Если пишешь функцию, пиши рабочую версию. Если нужен пакет, укажи команду установки.
7. **Compat-слой:** `firebase.js` предоставляет Firebase-style API поверх Supabase. Не ломай этот слой без веской причины. Все вызовы `ref()`, `get()`, `set()`, `onValue()` работают через Supabase.
8. **Глобальные переменные:** Проект использует `window.*` для межфайловой коммуникации. При добавлении новых функций документируй новые глобальные переменные.
9. **Звуки и уведомления:** Используй `SoundManager.play()` для звуков и `window.notify()` для сообщений. Не используй `alert()` или `console.log()` для пользовательского вывода.
10. **PWA:** Приложение работает как PWA. Не ломай `sw.js` и `manifest.json` без предупреждения.
11. **Мобильная адаптивность:** На мобильных устройствах (`window.isMobile`) drag-and-drop отключён, используются клики. Всегда проверяй `window.isMobile` при работе с доской.
12. **Supabase credentials:** URL и anon-ключ находятся в `supabase-config.js`. Никогда не коммить реальные ключи в публичные репозитории.

## 🐛 Известные баги (приоритет исправления)

| Приоритет | Файл | Описание |
|-----------|------|----------|
| 🔴 Крит | `game-core.js:59` | `markGameReady` дублирует `markLobbyReady` — ставит флаг `lobby` вместо `game` |
| 🔴 Крит | `board-ui.js:492,571,629` | `window.game.game_over()` без null-чека — краш если игра не создана |
| 🔴 Крит | `controls.js:388-598` | Дублирование слушателей Supabase при повторном вызове `setupGameControls` |
| 🟡 Сред | `game-core.js:2673-2824` | Race condition: `ensureGameExists` + `addPlayerToGame` — оба могут сработать одновременно |
| 🟡 Сред | `controls.js:430` | `window.game.undo()` отменяет 1 ход, для takeback нужно отменить 2 хода (свой + соперника) |
| 🟡 Сред | `firebase.js:286-298` | `runTransaction` не атомарный read-modify-write — теряет обновления при конкуренции |
| 🟢 Низ | `auth.js:388-393` | Проверка Firebase error codes, но Supabase возвращает другие сообщения об ошибках |

## 🚀 Запуск

```bash
# Простой статический сервер (Node.js)
node server.js 3000

# Или любой другой:
npx serve .
python -m http.server 3000
```

Открой `http://localhost:3000` в браузере.

Для режима бота: `http://localhost:3000?bot=1`
Для игры по ссылке: `http://localhost:3000?room=<roomId>`
