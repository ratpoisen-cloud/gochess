# ♟ GoChess

Шахматное веб-приложение для игры с друзьями в реальном времени и против бота.

## 🛠 Технологический стек

- **Frontend:** React 18 + TypeScript + Vite
- **Стили:** Tailwind CSS (ретро-пиксельная тема)
- **Шахматная логика:** chess.js (валидация ходов, FEN, PGN)
- **Отображение доски:** react-chessboard
- **Стейт-менеджмент:** Zustand
- **Backend / База данных:** Supabase (Auth, Realtime, PostgreSQL)
- **Бот:** Stockfish (Web Worker + WASM)
- **Маршрутизация:** React Router v6

## 🚀 Запуск

```bash
# Установка зависимостей
npm install

# Копирование переменных окружения
cp .env.local.example .env.local

# Заполните .env.local вашими Supabase credentials

# Запуск dev-сервера
npm run dev
```

Откройте [http://localhost:5173](http://localhost:5173) в браузере.

## 📁 Структура проекта

```
src/
├── components/     # UI-компоненты (Button, Card, Modal, Toast)
├── pages/          # Страницы (Lobby, Game, Bot, Settings)
├── stores/         # Zustand stores (auth, game, board)
├── hooks/          # React hooks
├── lib/            # Утилиты и конфигурация (Supabase)
├── types/          # TypeScript типы
├── App.tsx         # Роутинг
└── main.tsx        # Точка входа
```

## ⚙️ Настройки

На странице **Settings** (`/settings`) доступны:
- **6 тем доски:** Forest, Ocean, Dark, Marble, Middle Earth, Chess.com
- **4 набора фигур:** Alpha, Chessnut, Pixel, Tatiana

Настройки сохраняются в `localStorage`.

## 📝 Лицензия

MIT
