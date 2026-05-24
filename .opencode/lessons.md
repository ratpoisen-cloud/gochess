# Lessons Learned

## 2026-05-24: Создание файлов вне src/
- Проблема: Groq создал components/, hooks/, lib/, pages/, stores/, types/ в корне (Svelte-код)
- Причина: не было правила "все файлы внутри src/"
- Исправление: добавлено правило #1 в conventions.md

## 2026-05-24: Svelte-синтаксис вместо React
- Проблема: stores/authStore.ts использовал Svelte writable вместо Zustand,
  lib/supabase.ts использовал $env/static/private вместо import.meta.env
- Причина: не было указания "React + Vite + Zustand" в контексте
- Исправление: полный техстек указан в conventions.md

## 2026-05-24: key={stableWidth} на ChessBoard
- Проблема: BotPage.tsx — key={stableWidth} вызывает remount доски при resize,
  сбрасывая стейт и анимации
- Причина: попытка форсить перерисовку при изменении ширины
- Исправление: никогда не использовать key={stableWidth} на <ChessBoard>

## 2026-05-24: Бот игнорирует уровень сложности
- Проблема: BotPage.tsx — Math.random() всегда, переменная level не используется
- Причина: отсутствовала логика easy/medium/hard
- Исправление: реализовать выбор сложности: easy (случайные ходы), medium (минимакс 2 хода),
  hard (Stockfish WASM или минимакс 4 хода)
