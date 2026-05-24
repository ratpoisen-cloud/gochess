# GoChess Conventions

## Техстек
- React 18 + TypeScript 5 + Vite 5
- Tailwind CSS 3 (CSS-переменные, не хардкодь цвета)
- chess.js v1.0.0-beta.8 (класс Chess, методы .move(), .fen(), .history())
- react-chessboard v4.7.2 (компонент Chessboard, пропсы position, onPieceDrop, boardWidth)
- Zustand v4 (create + persist middleware)
- React Router v6 (BrowserRouter, Route, Link, useNavigate)
- lucide-react (SVG-иконки)

## Архитектура
- src/App.tsx — роуты: /, /bot, /local, /settings, /agent-logs
- src/main.tsx — точка входа: BrowserRouter + ToastProvider
- src/stores/ — Zustand: gameStore, authStore, boardStore
- src/pages/ — LobbyPage, BotPage, LocalPage, SettingsPage
- src/components/ — UI: ChessBoard, Button, Card, Modal, Toast...
- src/components/board/ChessBoard.tsx — обёртка react-chessboard
- src/hooks/ — useAuth, useBoardWidth
- src/lib/ — soundManager.ts
- src/types/ — Color, GameStatus, BotLevel, User

## Правила (НАРУШАТЬ НЕЛЬЗЯ)
1. Все файлы ТОЛЬКО внутри src/. Никогда не создавай папки в корне:
   components/, hooks/, lib/, pages/, stores/, types/
2. Стейт-менеджмент: Zustand. Не Svelte store, не Redux.
3. Импорты через алиас @/ (например, @/stores/gameStore)
4. CSS-переменные из index.css (--bg, --accent-brand, --text, --border, --radius-8 и т.д.)
5. Шахматная логика: chess.js. FEN — единственный источник истины о позиции.
6. Пиши ТОЛЬКО код. Без комментариев, без пояснений.
7. Формат вывода: ```file:src/путь/к/файлу.tsx\nкод\n```
8. Не используй any без крайней необходимости.
9. Не удаляй существующие файлы без явного указания в плане.
10. Не создавай файлы, не указанные в плане.

## Цвета (CSS-переменные)
--bg: #000000 (фон)
--accent-brand: #a3c18f (зелёный акцент)
--text: #e8e8d8 (молочный текст)
--text-secondary: rgba(232, 232, 216, 0.6)
--danger: #c15a5a
--success: #7eb87e
--border: rgba(163, 193, 143, 0.2)
--radius-4: 4px
--radius-8: 8px
--btn-radius: 8px
--space-4: 4px ... --space-32: 32px
--font-size-xs: 10px ... --font-size-xl: 20px

## Ключевые файлы
- src/stores/gameStore.ts — игровой стейт (Chess instance, makeMove, selectSquare, resetGame), persist middleware
- src/stores/boardStore.ts — темы доски и наборы фигур (BOARD_THEMES, PIECE_SETS)
- src/stores/authStore.ts — авторизация (user, isLoading)
- src/components/board/ChessBoard.tsx — обёртка react-chessboard с кастомными фигурами, подсветкой, hover-превью
- src/pages/BotPage.tsx — игра с ботом (onDrop → makeMove, setTimeout для хода бота)
- src/pages/LocalPage.tsx — игра вдвоём на одном ПК
- src/pages/LobbyPage.tsx — хаб с тайлами (бот, локальная, турниры)
- src/pages/SettingsPage.tsx — тема доски, набор фигур, профиль
