# Проект: GoChess

**Описание:** Шахматное веб-приложение для игры с друзьями в реальном времени, против бота, вдвоём на одном устройстве и с магией.

## Технологический стек
- **Frontend:** React 18 + TypeScript + Vite
- **Стили:** Tailwind CSS (монохромная ретро-пиксельная тема)
- **Шахматная логика:** EngineAPI (единый интерфейс) — PoisenChess Engine (784 строки, perft-валидирован, стандарт) + SpellChessEngine (886 строк, 9 заклинаний) + AtomicChessEngine (117 строк) через `createEngine(mode, fen?)` фабрику
- **Отображение доски:** `react-chessboard` (v4.7.2)
- **Стейт-менеджмент:** Zustand (с persist middleware)
- **Backend / База данных:** Firebase (Auth, Firestore) — `signInWithPopup`, email/password
- **Бот:** Ichi — собственный ИИ (minimax + αβ + PST, Web Worker) — 4 уровня сложности
- **Маршрутизация:** React Router v6
- **VFX:** `MagicVFX.tsx` — пиксельные частицы для заклинаний (canvas + requestAnimationFrame); `PixelConfetti.tsx` — победные конфетти

## Архитектура проекта

```
src/
├── App.tsx                     # Роутинг: /, /game/:roomId, /bot, /settings, /offline, /local/:mode, /completed, /atomic
── main.tsx                    # Точка входа: BrowserRouter, ToastProvider
├── index.css                   # CSS-переменные, layout, board highlights, scroll fix
├── components/
│   ├── board/
│   │   ├── ChessBoard.tsx      # Обёртка react-chessboard: click-to-move, hover-превью, подсветка
│   │   ├── ChessTimer.tsx      # Шахматные часы (delta-based, MM:SS, onTimeout)
│   │   ├── SpellBar.tsx        # Панель заклинаний (минимал: иконки + long press tooltip)
│   │   ├── SpellTile.tsx       # Тайл заклинания (без фона/рамки, long press)
│   │   ├── SpellInfoPanel.tsx  # Боковая панель информации о заклинании
│   │   └── ...
│   ├── MagicVFX.tsx            # Пиксельные VFX для заклинаний
│   ├── PixelConfetti.tsx       # Победные конфетти
│   ├── ReactionPicker.tsx      # Выбор эмодзи-реакции на клетку
│   ├── Toast.tsx               # Toast-уведомления
│   ├── Modal.tsx               # Базовая модалка
│   ├── SettingsDropdown.tsx    # Выпадающее меню тем/фигур
│   └── ...
├── pages/
│   ├── GamePage.tsx            # Игра онлайн: доска, SpellBar (x2), таймеры, VFX, click-outside deselect
│   ├── BotPage.tsx             # Игра с ботом
│   ├── LocalPage.tsx           # Локальная классика / рапид
│   ├── SpellLocalPage.tsx      # Локальный Spell Chess (старый инвентарь)
│   ├── AtomicLocalPage.tsx     # Локальный Atomic Chess
│   ├── OfflineHubPage.tsx      # Лобби «Вдвоём»
│   ├── OnlineHubPage.tsx       # Онлайн-лобби
│   ├── LobbyPage.tsx           # Главный хаб
│   ├── SettingsPage.tsx        # Настройки профиля, темы, фигур
│   └── ...
├── stores/
│   ├── authStore.ts            # Zustand user
│   ├── boardStore.ts           # theme + pieceSet (persist)
│   ├── gameStore.ts            # game state (persist)
│   ├── reactionStore.ts        # reactions + rate limit
│   └── spellGameStore.ts       # SpellChessEngine state
├── hooks/
│   ├── useAuth.ts              # Firebase auth (signInWithPopup, email/password)
│   ├── useBoardWidth.ts        # ResizeObserver + debounce
│   ├── useGameSync.ts          # Онлайн-синхронизация (~838 строк: sync, castSpell, timers)
│   ├── useGameTimer.ts         # Шахматные часы (отдельный хук)
│   ├── useGameRequest.ts       # Undo/Draw запросы
│   ├── useRematch.ts           # Рематч
│   ├── useRoomJoin.ts          # Подключение к комнате
│   └── usePgnCopy.ts           # Копирование PGN
├── lib/
│   ├── engine/
│   │   ├── PoisenChess.ts      # Стандартный движок (784 строки, perft)
│   │   ├── SpellChessEngine    # Spell Chess (886 строк, 9 заклинаний)
│   │   ├── AtomicChessEngine.ts # Atomic Chess (117 строк)
│   │   ├── factory.ts          # createEngine(mode, fen?) — фабрика
│   │   ├── types.ts            # EngineAPI, Move, Piece
│   │   └── index.ts            # barrel
│   ├── bot/
│   │   ├── ichiBot.ts          # Ichi AI (minimax+αβ+PST, 179 строк)
│   │   └── ichi.worker.ts      # Web Worker для Ichi
│   ├── soundManager.ts         # Звуки ходов
│   ├── firebase.ts             # Firebase client
│   └── spells/                 # PNG иконки заклинаний (публичный путь)
└── types/
    └── index.ts                # Color, GameMode, GameData, Challenge
```

## Дизайн-система (CSS-переменные)

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
- `touch-action: manipulation` — разрешает скролл на мобильных (не `none`)

**Layout:**
- `--game-layout-gap: 20px` — отступ между колонками
- `--game-main-column-width: 1100px` — ширина основной колонки
- `--game-side-column-width: 400px` — ширина боковой колонки
- `--board-min-size: 320px` — минимальный размер доски

## Порядок загрузки

```
1. React 18 + ReactDOM
2. React Router v6 (BrowserRouter)
3. Firebase SDK → lib/firebase.ts
4. Zustand stores (authStore, boardStore, gameStore, reactionStore)
5. hooks/useAuth.ts — подписка на auth state changes
6. components/Toast.tsx — ToastProvider обёртка
7. App.tsx — Routes: /, /game/:roomId, /bot, /settings, /offline, /local/:mode, /atomic
8. pages/LobbyPage.tsx — главная страница (точка входа)
```

## Правила для ИИ-ассистента

При написании кода для этого проекта строго соблюдай следующие правила:

1. **Фокус на чистоте:** Пиши модульный, читаемый код. Разделяй движок (EngineAPI), интерфейс (react-chessboard + React) и сеть (Firebase).
2. **EngineAPI:** Все игровые режимы используют `EngineAPI` интерфейс из `lib/engine/types.ts`. Фабрика `createEngine(mode, fen?)` из `lib/engine/factory.ts` возвращает нужный движок. Не используй `chess.js` напрямую.
3. **Шаги (Step-by-Step):** Не пытайся написать всё приложение за один ответ. Решай задачу по частям, жди подтверждения работоспособности.
4. **Обработка ошибок:** Всегда оборачивай сетевые запросы к Firebase в `try/catch` и выводи понятные сообщения через `useToast()`.
5. **Состояние игры:** FEN-строка — единственный источник истины о состоянии доски. PGN — для истории ходов.
6. **Никаких заглушек:** Если пишешь функцию, пиши рабочую версию. Если нужен пакет, укажи команду установки.
7. **Zustand stores:** Используй Zustand для стейта. `gameStore` и `boardStore` используют `persist` middleware для localStorage. Не persist-ь экземпляры классов (Chess, EngineAPI) — храни FEN/PGN.
8. **CSS-переменные:** Все стили используют CSS-переменные из `index.css`. Не хардкодь цвета и размеры.
9. **Звуки и уведомления:** Используй `soundManager.play()` для звуков и `useToast()` для сообщений. Не используй `alert()` или `console.log()` для пользовательского вывода.
10. **TypeScript:** Проект на TypeScript. Не используй `any` без крайней необходимости. Если CI выдаёт ошибку типа «сравнение без пересечения» — используй `as string` для обхода.
11. **react-chessboard:** Библиотека требует числовой `boardWidth` проп для корректной работы. Используй хук `useBoardWidth` для измерения контейнера.
12. **Spell Chess Engine:** `spellChessEngine.ts` — standalone движок, не использует chess.js. Король может быть взят (king capture = game over). 9 заклинаний с системой зарядов (без маны/кулдаунов). Free-действия (jump/shield/portal) не заканчивают ход, Terminal — заканчивают. Разные наборы для белых (berserk, divineGrace) и чёрных (shadowGrave, mirage). Заклинания открываются по ходу игры (SPELL_UNLOCK).
13. **Spell Bar UI:** Минималистичные тайлы без фона/рамки, только иконка (70% от тайла). Long press (500ms) показывает тултип с описанием. Клик по тайлу выбирает заклинание, клик вне доски сбрасывает выбор. `SpellBar.tsx` прозрачный контейнер (gap-1), тултип встроенный (SPELL_DETAILS).
14. **MagicVFX:** canvas + requestAnimationFrame для пиксельных эффектов заклинаний. 5 типов: ICE_SHATTER, BLAST, JUMP, PORTAL, CONFETTI.

## 🐛 Известные баги (приоритет исправления)

| Приоритет | Файл | Описание |
|-----------|------|----------|
| 🟡 Сред | `SpellChessEngine` | `moves()` verbose mode возвращает не-verbose формат |
| 🟡 Сред | `MagicVFX.tsx` | Звуки заклинаний не реализованы — используют `'move'` звук |
| 🟢 Низ | `PixelConfetti.tsx` | `canvas.scale()` при resize накапливается (без сброса transform) |
| 🟢 Низ | `spellChessEngine.ts` | Отсутствует promotion для Spell Chess |
| 🟢 Низ | `firestore.indexes.json` | Нужен индекс для challenges (status, toId, createdAt) |
| 🟢 Низ | `public/sw.js` | SW падает с 206 Partial Response при кэшировании аудио |
| 🟢 Низ | `vite.config.ts:7` | Хардкод `base: '/gochess/'` — сломает локальный dev |
| 🔴 Крит | CI (GitHub Actions) | TypeScript 5.5+ сужает `gameMode` после `===` проверок внутри объекта. **Решение:** выносить сравнения в булевы константы или использовать `as string` |

## ✅ Исправленные баги

| Баг | Файлы | Описание |
|-----|-------|----------|
| ✅ Доска маленького размера при загрузке | `useBoardWidth.ts`, `BotPage.tsx`, `GamePage.tsx`, `index.css` | `useLayoutEffect` заменён на `useEffect`, добавлен `stableWidth` с debounce 150ms и порогом 300px, убран `key={stableWidth}` (вызывал remount при resize), убраны `!important` хаки в CSS |
| ✅ Настройки недоступны без авторизации | `LobbyPage.tsx` | Добавлена кнопка-шестерёнка в хедер лобби, доступна всем |
| ✅ Hover-превью ходов | `ChessBoard.tsx` | При наведении на фигуру показываются доступные ходы с корректными цветами темы |
| ✅ Drag-and-drop удалён | — | Click-to-move + hover-превью вместо drag-and-drop |
| ✅ Иконка настроек на всех страницах | `BotPage.tsx`, `LocalPage.tsx`, `GamePage.tsx` | SVG gear icon в хедере каждой игровой страницы |
| ✅ Пиксельный дизайн + dropdown меню | — | Упрощены радиусы, убраны 3D-эффекты и тени. Создан SettingsDropdown |
| ✅ Монохромная тема | — | Чёрный фон, зелёные акценты, без теней и градиентов |
| ✅ Превращение пешки (интегрированный пикер) | `GamePage.tsx` | Вертикальный пикер на доске, привязанный к клетке превращения |
| ✅ Не загружалась страница игры | `GamePage.tsx` | `authLoading` блокировал рендер. Убрана проверка authLoading |
| ✅ Последние партии не грузились | `LobbyPage.tsx` | Сортировка на клиенте вместо `orderBy` в Firestore |
| ✅ Бот ходит случайно | `BotPage.tsx`, `botEngine.ts` | Stockfish заменён на Ichi (minimax+αβ+PST, Web Worker) |
| ✅ Spell Chess: кулдауны на оба цвета | `spellChessEngine.ts` | Кулдауны обоих цветов декрементятся каждый ход |
| ✅ Spell Chess: множественные экземпляры движка | `spellGameStore.ts` | Единый `defaultEngine` |
| ✅ Spell Chess: customSquareStyles | `SpellLocalPage.tsx` | Обёрнуто в `useMemo` |
| ✅ Онлайн-лобби | `OnlineHubPage.tsx` | Создание/поиск комнат |
| ✅ Офлайн-лобби | `OfflineHubPage.tsx` | Выбор Классика/Рапид/Магия |
| ✅ PWA установка | `public/manifest.json`, `sw.js` | Service Worker + иконки 192/512px |
| ✅ Spell Chess: 9 заклинаний, система зарядов | `spellChessEngine.ts` | 9 spell types, charges вместо маны, разные наборы для цветов |
| ✅ Spell Chess: механики по кодексу | `spellChessEngine.ts` | freeze → 2 хода, portal → bidirectional, divineGrace → только свои |
| ✅ Spell Chess: онлайн-синхронизация | `useGameSync.ts` | EngineAPI адаптеры, castSpell, spell_state_json в Firestore |
| ✅ Stale-turn guard в онлайн-синхронизации | `useGameSync.ts` | Сравнение `freshData.turn !== preMoveTurn` вместо `g.turn()` |
| ✅ Auth: signInWithPopup работает | `useAuth.ts`, `firebase.ts` | Возврат к `signInWithPopup` (COOP-варнинг нефатален) |
| ✅ Auth: Firestore присутствие | `firestore.rules` | Правила для `__firestore_presence__` коллекции |
| ✅ Spell Bar: emoji-picker стиль | `SpellBar.tsx`, `SpellTile.tsx` | Квадратные тайлы, тёмный стеклянный контейнер, 70% иконки |
| ✅ Spell Bar: сброс упрощений соперника | `SpellBar.tsx`, `GamePage.tsx` | Панель соперника выглядит как у игрока |
| ✅ Spell Bar: сортировка по unlock | `SpellBar.tsx` | Заклинания отсортированы по `SPELL_UNLOCK` |
| ✅ Spell Bar: размер шрифта статуса | `GamePage.tsx` | «Ваш ход» = `text-[var(--font-size-sm)]` (как имя) |
| ✅ Spell Bar: layout порядок | `GamePage.tsx` | Статус-бар → панель соперника → доска + панель игрока |
| ✅ Spell Bar: убран title tooltip | `GamePage.tsx` | Убран `title="Туман войны"` из статус-бара |
| ✅ Spell Bar: минимал без фона/рамки | `SpellTile.tsx`, `SpellBar.tsx` | Только иконки + unlock номер. Long press → тултип |
| ✅ Spell Bar: click-outside deselect | `GamePage.tsx` | `game-main-column onClick → setActiveSpell(null)` |
| ✅ Spell Bar: 1/2 клик выбор/отмена | `GamePage.tsx` | 1-й клик выбирает, 2-й отменяет заклинание |
| ✅ CI: narrow type в useEffect | `GamePage.tsx` | Замена `gameMode === 'atomic_chess'` на константу + `as string` |
| ✅ Звук на первом снэпшоте | `useGameSync.ts` | `initialSnapshotRef` блокирует `soundManager.play()` на 4 call sites при первом снэпшоте |
| ✅ Mobile touch: e.preventDefault() не блокирует клики | `ChessBoard.tsx` | `e.preventDefault()` удалён из `handleTouchStart`, перемещён в long-press callback (500ms) |
| ✅ Ширина доски при первой загрузке | `useBoardWidth.ts`, `GamePage.tsx` | `immediateWidth` (не-debounced) для первого рендера, `stableWidth` для resize |
| ✅ Loading fluctuations ломают layout | `GamePage.tsx` | `initialLoadComplete` guard предотвращает remount при флуктуациях loading |
| ✅ Бесконечный цикл переподписок Firestore | `useGameSync.ts` | `processSnapshotData` deps стабилизированы: `timer`/`requests`/`rematch` → `setTimerFromSnapshot`/`setRequestsFromSnapshot`/`setRematchFromSnapshot` (стабильные useCallback) |
| ✅ Atomic/Spell PGN branch создаёт стандартный движок | `useGameSync.ts` | PGN branch теперь использует `createEngine(gameOverMode)` с правильным mode |
| ✅ Atomic gameOver создаёт стандартный движок | `useGameSync.ts` | game_over block (line 167) теперь использует `createEngine(gameOverMode)` с правильным mode |
| ✅ SpellChessEngine не инициализирован при отсутствии SSJ | `useGameSync.ts` | Добавлена ветка `isSpell && !newData.spell_state_json && lastSpellStateJsonRef.current === null` — создаёт движок из FEN, сохраняет default SSJ |
| ✅ SpellChessEngine.pgn() реализован | `spellChessEngine.ts` | Возвращает SAN PGN с move numbers и `[Result "..."]` (был пустой stub `''`) |
| ✅ Бесконечный звук в Spell/Atomic при загрузке | `useGameSync.ts` | PGN-ветка защищена `!isSpell && !isAtomic` guard; все SSJ-ветки потребляют `lastPgnRef.current = newData.pgn \|\| lastPgnRef.current` |
| ✅ Навигация по принятому вызову (инвайты) | `useChallenges.ts` | Добавлен `onSnapshot` для `where('fromId', '==', user.uid) && where('status', '==', 'accepted')` с фильтром `expiresAt > Date.now()`; автопереход через `navigate()` |
| ✅ SW 206 Partial Response крашит кэш | `public/sw.js` | Добавлен `\|\| res.status === 206` в guards на строках 26 и 38 — Cache API не поддерживает 206 |
| ✅ React #310 (conditional hooks) | `GamePage.tsx` | 4 хука (`initialLoadComplete`, `handleOpponentTimeout`, `handlePlayerTimeout`) перенесены перед ранними return'ами (строки 449/459) — ошибка "fewer hooks than previous render" при флуктуации auth состояния | |

## 🧠 Извлечённые уроки

### 1. Firestore: `orderBy` исключает документы без поля
Если документ не имеет поля, указанного в `orderBy`, он **не возвращается** в результатах запроса. **Решение:** сортировать на клиенте, использовать Firestore только для фильтрации.

### 2. Firestore: составные индексы не нужны для `where` без `orderBy`
`query(collection, where('field', '==', value))` работает сразу — используются авто-созданные одно-полевые индексы.

### 3. Firestore: `serverTimestamp()` vs `Date.now()`
`serverTimestamp()` — Firestore Timestamp (`.seconds`, `.nanoseconds`). `Date.now()` — число ms. При клиентской сортировке обрабатывать оба типа.

### 4. GitHub Pages: Google OAuth + COOP
`signInWithPopup` на GitHub Pages вызывает COOP-варнинг (нефатально). `signInWithRedirect` не работает на GitHub Pages. **Решение:** использовать email/password или `signInWithPopup`.

### 5. GitHub Pages: SPA роутинг
Нужен `public/404.html` как fallback для всех маршрутов SPA.

### 6. Zustand persist + несериализуемые объекты
Не использовать `persist` для экземпляров классов. **Решение:** хранить FEN/PGN, создавать `new Chess()` / `createEngine()` на лету.

### 7. React 18: `authLoading` race condition
Проверять `authLoading` только в эффектах, не в рендере.

### 8. Mobile scroll: `touch-action: none` ломает скролл
`.board-container` с `touch-action: none` блокирует вертикальный скролл на мобильных. **Решение:** использовать `touch-action: manipulation` (разрешает скролл, отключает double-tap zoom).

### 9. CI TypeScript: narrowing в замыканиях
TypeScript 5.5+ сужает тип переменной после `===` проверки в той же области видимости, включая замыкания (useEffect). **Решение:** выносить сравнения в булевы константы до `useEffect` или кастить `as string`.

### 10. CI TypeScript: inferred return type из сложных объектов
При возврате объекта с type guard expressions (тернарники) TypeScript может сузить тип переменной в месте возврата, что влияет на тип всей возвращаемой переменной. **Решение:** явные возвращаемые типы или касты.

### 11. Firestore: `useCallback` deps не должны содержать объекты
При передаче объекта (возврата хука) в `useCallback` deps, каждый рендер создаёт новый объект → `useCallback` возвращает новую ссылку → `useEffect` с `onSnapshot` переподписывается → бесконечный цикл. **Решение:** передавать только стабильные методы (`setTimerFromSnapshot` вместо `timer`).

### 12. createEngine(mode) для PGN/gameOver в нестандартных режимах
PGN-ветка и game_over блок в `processSnapshotData` создавали `createEngine()` без mode, что для Atomic/Spell заменяло игровой движок стандартным. **Решение:** выводить mode из `newData.game_mode`.

## 🚀 Запуск

```bash
# Установка зависимостей
npm install

# Запуск dev-сервера
npm run dev
```

Открой `http://localhost:5173` в браузере.

Для режима бота: `http://localhost:5173/bot`
Для игры по ссылке: `http://localhost:5173/game/<roomId>`
