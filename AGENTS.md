# Проект: GoChess

**Описание:** Шахматное веб-приложение для игры с друзьями в реальном времени и против бота.

##  Технологический стек
- **Frontend:** React 18 + TypeScript + Vite
- **Стили:** Tailwind CSS (ретро-пиксельная тема)
- **Шахматная логика:** `chess.js` (v1.0.0-beta.8) — валидация ходов, FEN, PGN
- **Отображение доски:** `react-chessboard` (v4.7.2)
- **Стейт-менеджмент:** Zustand (с persist middleware)
- **Backend / База данных:** Firebase (Auth, Firestore)
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
│   │   └── ChessBoard.tsx      # Обёртка react-chessboard: кастомные фигуры, подсветка
│   ├── AuthModal.tsx           # Модалка входа/регистрации (email + Google)
│   ├── Button.tsx              # Кнопки: primary, outline, draw, danger, success, ghost
│   ├── Card.tsx                # Карточка-контейнер
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
│   ├── useAuth.ts              # Firebase auth: signIn, signUp, signOut, uploadAvatar
│   └── useBoardWidth.ts        # Измерение ширины контейнера доски (ResizeObserver + debounce)
├── lib/
│   ├── soundManager.ts         # Звуки: move, capture, check, checkmate, promote
│   └── firebase.ts             # Firebase client
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

##  Порядок загрузки

```
1. React 18 + ReactDOM
2. React Router v6 (BrowserRouter)
3. Firebase SDK → lib/firebase.ts
4. Zustand stores (authStore, boardStore, gameStore, reactionStore)
5. hooks/useAuth.ts — подписка на auth state changes
6. components/Toast.tsx — ToastProvider обёртка
7. App.tsx — Routes: /, /game/:roomId, /bot, /settings
8. pages/LobbyPage.tsx — главная страница (точка входа)
```

##  Правила для ИИ-ассистента

При написании кода для этого проекта строго соблюдай следующие правила:

1. **Фокус на чистоте:** Пиши модульный, читаемый код. Разделяй логику шахмат (chess.js), интерфейс (react-chessboard) и работу с сетью (Firebase).
2. **Шаги (Step-by-Step):** Не пытайся написать всё приложение за один ответ. Решай задачу по частям, жди подтверждения работоспособности.
3. **Обработка ошибок:** Всегда оборачивай сетевые запросы к Firebase в `try/catch` и выводи понятные сообщения через `useToast()`.
4. **Состояние игры:** FEN-строка — единственный источник истины о состоянии доски. PGN — для истории ходов.
5. **Никаких заглушек:** Если пишешь функцию, пиши рабочую версию. Если нужен пакет, укажи команду установки.
6. **Zustand stores:** Используй Zustand для стейта. `gameStore` и `boardStore` используют `persist` middleware для localStorage.
7. **CSS-переменные:** Все стили используют CSS-переменные из `index.css`. Не хардкодь цвета и размеры.
8. **Звуки и уведомления:** Используй `soundManager.play()` для звуков и `useToast()` для сообщений. Не используй `alert()` или `console.log()` для пользовательского вывода.
9. **TypeScript:** Проект на TypeScript. Не используй `any` без крайней необходимости. chess.js v1 имеет строгие типы.
10. **react-chessboard:** Библиотека требует числовой `boardWidth` проп для корректной работы. Используй хук `useBoardWidth` для измерения контейнера.

## 🐛 Известные баги (приоритет исправления)

| Приоритет | Файл | Описание |
|-----------|------|----------|
| 🔴 Крит | `useAuth.ts:115` | `uploadAvatar` вызывает `updateProfile` которая определена ниже — не доступна в замыкании |
| 🔴 Крит | `gameStore.ts` | `persist` с Chess instance — антипаттерн для мультиплеера, стейт должен приходить с сервера |
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
| ✅ Унификация игровых режимов + Анимации | `LobbyPage.tsx`, `BotPage.tsx`, `LocalPage.tsx`, `GamePage.tsx`, `ColorPickerModal.tsx` | Внедрён единый стиль статус-бара (имена, иконки, пульсирующие индикаторы хода). Реализована кинематографичная заставка в лобби (посимвольный набор текста + «печать» логотипа). Стандартизированы модалки настроек (полноширинные кнопки, индикация выбора, специфичное поведение кнопки «Отмена»). |
| ✅ Превращение пешки (интегрированный пикер) | `GamePage.tsx`, `BotPage.tsx`, `LocalPage.tsx`, `ChessBoard.tsx` | Вместо центральной модалки реализован вертикальный пикер прямо на доске, привязанный к клетке превращения. Использует нативные ассеты фигур и адаптируется под разворот доски. Исправлен баг блокировки хода при drag-and-drop на последнюю горизонталь. |
| ✅ Расширенный локальный режим | `LocalPage.tsx` | Добавлены имена игроков, режимы «Авто-разворот» и «Лицом к лицу» (поворот черных фигур на 180° через свойство `rotate`). Интегрированы кнопки управления: Undo (отмена хода), Draw (ничья), Resign (сдача). |
| ✅ Исправлен вылет useBoardStore | `LocalPage.tsx`, `BotPage.tsx` | Устранена ошибка `ReferenceError: useBoardStore is not defined` в модалке превращения путём корректного импорта и инициализации стора в компонентах. |
| ✅ Не загружалась страница игры (LoadingScreen бесконечно) | `GamePage.tsx` | `authLoading` блокировал рендер даже после `loading = false`. Убрана проверка `if (authLoading) return <LoadingScreen />` — LoadingScreen управляется только стейтом `loading`. |
| ✅ Последние партии не грузились в лобби | `LobbyPage.tsx`, `firestore.indexes.json` | После смены `orderBy('created_at')` на `orderBy('last_move_time')` запрос перестал возвращать документы без поля `last_move_time` (старые игры). Исправлено: убран `orderBy` из Firestore-запроса, сортировка клиентская по `last_move_time` с fallback на `created_at`. |
| ✅ Бот ходит случайно, уровни не работают | `BotPage.tsx`, `src/lib/botEngine.ts`, `public/engine/` | Подключён Stockfish 18 (WASM + Web Worker). Уровни: easy (depth=3, skill=0, 50ms), medium (depth=5, skill=2, 100ms), hard (depth=8, skill=4, 220ms). Fallback на случайный ход при ошибке движка. |

## 🧠 Извлечённые уроки

### 1. Firestore: `orderBy` исключает документы без поля
Если документ не имеет поля, указанного в `orderBy`, он **не возвращается** в результатах запроса (даже если соответствует `where`). **Решение:** сортировать на клиенте, использовать Firestore только для фильтрации.

### 2. Firestore: составные индексы не нужны для `where` без `orderBy`
`query(collection, where('field', '==', value))` работает сразу — используются авто-созданные одно-полевые индексы. **Решение:** избегать `orderBy` в Firestore, если порядок можно задать на клиенте.

### 3. Firestore: `serverTimestamp()` vs `Date.now()`
`serverTimestamp()` — Firestore Timestamp (`.seconds`, `.nanoseconds`). `Date.now()` — число ms. При клиентской сортировке нужно обрабатывать оба типа: `typeof val === 'number' ? val : val.seconds * 1000`.

### 4. GitHub Pages: Google OAuth блокируется COOP
`signInWithPopup` на GitHub Pages падает с `Cross-Origin-Opener-Policy`. GitHub Pages не даёт настроить COOP/COEP заголовки. **Решение:** использовать `signInWithRedirect` (было отклонено пользователем) или email/password как основной метод входа.

### 5. GitHub Pages: SPA роутинг
Для SPA на GitHub Pages нужно иметь `public/404.html`, который Vite копирует в `dist/` как fallback для всех маршрутов. Без него маршруты вида `/game/XFNAJT` отдают 404.

### 6. Zustand persist + несериализуемые объекты
Не использовать `persist` для стейтов, содержащих экземпляры классов (например, `Chess` из chess.js). persist пытается сериализовать в JSON — `Chess` методы теряются. **Решение:** хранить FEN/PGN строки в сторе, создавать `new Chess()` на лету.

### 7. React 18: `authLoading` блокирует рендер
Если в компоненте есть `useEffect`, который меняет `authLoading` (глобальный стейт), и рендер проверяет `authLoading` до `user`/`loading`, возникает race condition — LoadingScreen может застрять. **Решение:** проверять `authLoading` только в эффектах, не в рендере.

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
