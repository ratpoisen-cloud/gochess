# ♟ GoChess

Шахматное веб-приложение для игры с друзьями в реальном времени, против бота и вдвоём на одном устройстве.

## 🛠 Технологический стек

- **Frontend:** React 18 + TypeScript + Vite
- **Стили:** Tailwind CSS (ретро-пиксельная тема)
- **Шахматная логика:** chess.js (классика), собственный Spell Chess Engine (магия)
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
| **Бот** | 4 уровня сложности: Very Easy, Easy, Medium, Hard (Ichi minimax AI) |
| **Локальная классика** | Вдвоём на одном устройстве, «Авто-разворот» или «Лицом к лицу» |
| **Локальный рапид** | То же, но с шахматными часами (10 мин на партию) |
| **Spell Chess (Магия)** | Нестандартные правила: заклинания, взятие короля, без превращения пешек |

### Spell Chess (Магия)

- **5 заклинаний:** Заморозка (3×3), Прыжок, Взрыв (крест), Щит, Портал
- Взятие короля = победа (нет шаха/мата)
- Кулдауны на оба цвета
- Пиксельные VFX-эффекты на canvas

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
├── hooks/            # useAuth, useBoardWidth
├── lib/              # firebase, soundManager, spellChessEngine
├── types/            # TypeScript типы
├── App.tsx           # Роутинг
└── main.tsx          # Точка входа
```

## 📱 PWA

Приложение можно установить на домашний экран (iOS/Android) для офлайн-игры против бота и локальных режимов.

## 🐛 Известные ограничения

- Google OAuth через `signInWithPopup` не работает на GitHub Pages (COOP-политика). Используйте email/password.
- Spell Chess: отсутствует превращение пешки, звуки заклинаний используют звук хода

## 📝 Лицензия

MIT
