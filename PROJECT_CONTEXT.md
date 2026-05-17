# GoChess — Контекст проекта

## Описание
Веб-приложение для игры в шахматы с друзьями в реальном времени. Ретро-пиксельная эстетика (`Press Start 2P`), тёмная тема с зелёными акцентами.

Две версии:
- **Testproject/** — оригинал (Vanilla JS + Supabase + chess.js + chessboard.js)
- **src/** — новая версия (React + Vite + TypeScript + Tailwind + Zustand)

## Технологический стек (новая версия)
- **Фреймворк:** React 19 + TypeScript
- **Сборка:** Vite 7
- **Стили:** Tailwind CSS 4
- **Шахматы:** chess.js
- **Доска:** react-chessboard
- **Состояние:** Zustand
- **Роутинг:** react-router-dom v7
- **Бэкенд:** Supabase (в процессе интеграции)
- **Деплой:** GitHub Pages (`/gochess/` base path)

## Архитектура

```
src/
├── main.tsx                 # Точка входа, BrowserRouter с basename
├── App.tsx                  # Роуты: /, /game/:roomId, /bot, /settings
├── index.css                # CSS-переменные, Tailwind, анимации
├── components/
│   ├── Button.tsx           # Кнопки: primary, secondary, outline, danger
│   ├── Card.tsx             # Карточки с padding вариантами
│   ├── Modal.tsx            # Модалки с анимацией
│   ├── Toast.tsx            # Тосты: info, success, warning, error
│   ├── LoadingScreen.tsx    # Экран загрузки с пульсацией
│   ├── ErrorBoundary.tsx    # React Error Boundary
│   └── ReactionPicker.tsx   # Пикер эмодзи-реакций
├── pages/
│   ├── LobbyPage.tsx        # Лобби: создание/подключение к игре
│   ├── GamePage.tsx         # Онлайн-игра: доска, история, реакции
│   ├── BotPage.tsx          # Игра с ботом: доска, выбор уровня
│   └── SettingsPage.tsx     # Настройки: темы, наборы фигур
├── stores/
│   ├── gameStore.ts         # Chess instance, ходы, статус, подсветка
│   ├── boardStore.ts        # Темы доски (6), наборы фигур (4), persist
│   └── reactionStore.ts     # Эмодзи-реакции, TTL, rate limiting
├── hooks/
│   └── useSupabase.ts       # Supabase хуки (в разработке)
├── lib/
│   └── supabase.ts          # Supabase клиент (в разработке)
└── types/
    └── index.ts             # TypeScript типы
```

## CSS-переменные (ключевые)

```css
--game-main-column-width: 760px
--game-side-column-width: 360px
--game-layout-gap: 14px
--board-stack-gap: 12px
--board-min-size: 320px
```

## Темы доски (6)
- `chesscom` (default) — классические зелёные
- `forest` — лесные тона
- `ocean` — океанские
- `dark` — тёмные
- `marble` — мраморные
- `middle-earth` — средиземье

## Наборы фигур (4)
- `tatiana` (default)
- `alpha`
- `chessnut`
- `pixel`

## Подсветка ходов (оригинал из Testproject)

### Обычные ходы (highlight-possible)
```css
background: radial-gradient(circle, var(--board-highlight-possible) 28%, transparent 28%);
box-shadow: 0 0 8px var(--board-highlight-possible-shadow);
```

### Взятия (highlight-capture)
```css
box-shadow: inset 0 0 0 4px var(--board-highlight-capture);
```

### Выбранная фигура (highlight-selected)
```css
box-shadow: inset 0 0 0 4px var(--board-highlight-selected);
```

### Последний ход (last-move)
```css
box-shadow: inset 0 0 0 4px var(--board-last-move-outline);
```

### Шах (highlight-check)
```css
box-shadow: inset 0 0 0 4px var(--board-check-outline), 0 0 16px var(--board-check-glow);
```

## GitHub Pages
- **URL:** `https://<username>.github.io/gochess/`
- **base path:** `/gochess/`
- **SPA fallback:** `public/404.html` с redirect
- **CI/CD:** `.github/workflows/deploy.yml`

## Известные проблемы (требуют исправления)

### 🔴 Критичные
1. **Размер доски** — `react-chessboard` не заполняет контейнер, доска слишком маленькая
2. **SVG фигуры** — могут не загружаться из-за путей с base path `/gochess/`

### 🟡 Средние
3. **Подсветка ходов** — отличается от оригинала (нужно совпадение стиля)
4. **Responsive** — боковая панель не уходит под доску на мобильных

### 🟢 Низкие
5. **Бот** — случайные ходы вместо Stockfish
6. **Supabase** — не интегрирован (локальное состояние)

## Порядок загрузки (оригинал Testproject)
1. jQuery 3.5.1
2. chess.js 0.10.3
3. chessboard.js 1.0.0
4. Supabase SDK v2
5. js/supabase-config.js
6. js/utils.js
7. js/sound.js
8. js/themes.js
9. js/firebase.js (compat-слой)
10. js/presence.js
11. js/auth.js
12. js/board-ui.js
13. js/bot-engine.js
14. js/controls.js
15. js/ui.js
16. js/game-core.js
17. js/app.js

## Команды
```bash
npm run dev          # Dev сервер
npm run build        # Сборка для продакшена
npm run preview      # Превью сборки
npm run deploy       # Деплой на GitHub Pages
```

## База данных (Supabase)
### Таблицы
- `profiles` — профили пользователей
- `games` — активные/завершённые партии (room_id PK, players JSON, PGN, FEN)
- `user_presence` — онлайн-статус

### RPC
- `join_game_player_with_color` — атомарное присоединение к партии

## Ключевые файлы для изменений
- `src/pages/GamePage.tsx` — основная игровая страница
- `src/pages/BotPage.tsx` — страница игры с ботом
- `src/stores/boardStore.ts` — темы и фигуры
- `src/stores/gameStore.ts` — логика шахмат
- `src/index.css` — CSS-переменные
- `vite.config.ts` — base path для GitHub Pages

## MCP Серверы

### Supabase MCP
- **URL:** `https://mcp.supabase.com/mcp?project_ref=qrziisfzaapbskhbydcv`
- **Доступ:** Full (чтение + запись)
- **Аутентификация:** OAuth (автоматически через opencode)
- **Команда для auth:** `opencode mcp auth supabase`
- **Проверка:** `opencode mcp list`
- **Конфиг:** `opencode.json` в корне проекта

Используется для:
- Управления таблицами и схемами БД
- Создания и применения миграций
- Настройки RLS политик
- Генерации TypeScript типов из схемы
- Дебага через логи и advisors

### Доступные инструменты
- `supabase_list_tables` — список таблиц
- `supabase_execute_sql` — SQL запросы (SELECT, INSERT, UPDATE)
- `supabase_apply_migration` — DDL изменения (CREATE TABLE, ALTER, RLS)
- `supabase_list_migrations` — список миграций
- `supabase_generate_typescript_types` — генерация TS типов
- `supabase_search_docs` — поиск в документации
- `supabase_get_logs` — логи сервисов
- `supabase_get_advisors` — советы по безопасности
- `supabase_get_project_url` — API URL проекта
- `supabase_get_publishable_keys` — anon/publishable ключи
